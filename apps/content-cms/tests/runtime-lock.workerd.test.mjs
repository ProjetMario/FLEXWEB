import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { ORIGINAL_SHA256, REGISTRY_FILE, sha256, originalSourceFromPatched } from '../scripts/apply-emdash-lock-patch.mjs';

const source = (await readFile(new URL('../src/runtime/request-owned-lock.mjs', import.meta.url), 'utf8')).replaceAll('export ', '');
const installed = await readFile(new URL('../node_modules/emdash/' + REGISTRY_FILE, import.meta.url), 'utf8');
const original = sha256(installed) === ORIGINAL_SHA256 ? installed : originalSourceFromPatched(installed);
const start = original.indexOf('async function withContentUsageCollectionLock(');
const native = 'const locks = new Map(); function getContentUsageCollectionLocks(){ return locks; }\n'
  + original.slice(start, original.indexOf('\nfunction getContentUsageLocks()', start))
  + '\nconst lock = withContentUsageCollectionLock;';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(variant, fn) {
  const worker = `${variant === 'native' ? native : source + '\nconst lock = createRequestOwnedLock();'}
    const state={active:0,maximum:0,entered:[]};
    export default {async fetch(request,env,ctx){
      const p=new URL(request.url).searchParams;
      if(p.has('stats'))return Response.json(state);
      try{return await lock('key',async()=>{
        state.active++;state.maximum=Math.max(state.maximum,state.active);state.entered.push(p.get('id'));
        try{
          if(p.has('stalled'))await new Promise(()=>{});
          if(p.has('db'))for(let i=0;i<3;i++)await env.DB.prepare('SELECT 1 AS test_only').first();
          await new Promise(resolve=>setTimeout(resolve,Number(p.get('work')||1)));
          if(p.has('throw'))throw new Error('TEST_OWNER_FAILURE');
          return Response.json({ok:true});
        }finally{state.active--;}
      },{maxWaitMs:Number(p.get('wait')||2000),anchor:promise=>ctx.waitUntil(promise)});
      }catch(e){return Response.json({code:e.code||e.message},{status:e.code==='MEDIA_USAGE_LOCK_WAIT_TIMEOUT'?503:500});}
    }};`;
  const options = convertV4MiniflareOptions({ modules: true, script: worker, host: '127.0.0.1', port: 0, cf: false,
    compatibilityDate: '2026-09-29', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'lock-test' }, log: new Log(LogLevel.NONE) });
  options.telemetry = { enabled: false };
  const mf = new Miniflare(options);
  try {
    const base = await mf.ready;
    const request = async (params, ms = 3000) => {
      try { const r = await fetch(new URL('?' + new URLSearchParams(params), base), { signal: AbortSignal.timeout(ms) }); await r.text(); return r.status; }
      catch (error) { if (error.name === 'TimeoutError' || error.name === 'AbortError') return 0; throw error; }
    };
    await fn({ base, request, stats: async () => (await fetch(new URL('?stats=1', base))).json() });
  } finally { await mf.dispose(); }
}

test('workerd: D1 calls at concurrency16 preserve per-key exclusion', async () => run('candidate', async ({ request, stats }) => {
  const statuses = await Promise.all(Array.from({ length: 16 }, (_, i) => request({ id: String(i), db: '1', work: '2' })));
  assert(statuses.every((status) => status === 200));
  const state = await stats(); assert.equal(state.maximum, 1); assert.equal(state.entered.length, 16);
}));

test('workerd: an owner rejection releases the mutex', async () => run('candidate', async ({ request, stats }) => {
  const owner = request({ id: 'owner', throw: '1', work: '70' }); await sleep(20);
  const waiter = request({ id: 'waiter' });
  assert.deepEqual(await Promise.all([owner, waiter]), [500, 200]); assert.equal((await stats()).maximum, 1);
}));

test('workerd: an abandoned owner connection does not release the lock early or poison later work', async () => run('candidate', async ({ base, request, stats }) => {
  const controller = new AbortController();
  const response = fetch(new URL('?id=abandoned&work=180', base), { signal: controller.signal })
    .then((r) => r.text()).catch((error) => {
      if (error.name !== 'AbortError') throw error;
    });
  // Observe acquisition before aborting; a transport cancellation before the
  // worker receives its request would not test owner cleanup.
  const deadline = Date.now() + 2000;
  while (!(await stats()).entered.includes('abandoned')) {
    assert(Date.now() < deadline, 'owner did not enter'); await sleep(5);
  }
  controller.abort(); await response;
  assert.equal(await request({ id: 'after-abandon' }), 200);
  const state = await stats(); assert.equal(state.maximum, 1); assert.equal(state.active, 0);
}));

test('workerd: a wait deadline rejects without executing or stealing, then permits recovery', async () => run('candidate', async ({ request, stats }) => {
  const owner = request({ id: 'owner', work: '150' }); await sleep(20);
  assert.equal(await request({ id: 'expired', wait: '25' }), 503);
  assert.equal(await owner, 200); assert.equal(await request({ id: 'after' }), 200);
  const state = await stats(); assert.equal(state.maximum, 1); assert(!state.entered.includes('expired'));
}));

test('workerd: the native orphan blocks later work, while the candidate fails within its own deadline', async () => {
  await run('native', async ({ request, stats }) => {
    assert.equal(await request({ id: 'stalled', stalled: '1' }), 500);
    const later = await request({ id: 'blocked', wait: '30' }, 300);
    assert([0, 500].includes(later)); assert(!(await stats()).entered.includes('blocked'));
  });
  await run('candidate', async ({ request, stats }) => {
    assert.equal(await request({ id: 'stalled', stalled: '1' }), 500);
    assert.equal(await request({ id: 'blocked', wait: '30' }, 500), 503);
    const state = await stats(); assert.equal(state.maximum, 1); assert(!state.entered.includes('blocked'));
  });
});
