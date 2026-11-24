import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, rename, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {parseArgs} from 'node:util';
import {parse} from 'parse5';
import {expectedLanguage} from '../../scripts/seo/recovery-language.mjs';
import {buildLegacyRedirects} from './legacy-global.mjs';

// node verify-legacy-redirects.mjs SITE_URL [--all] [--concurrency 6] [--rate 10] [--checkpoint FILE]
const {values, positionals} = parseArgs({
  allowPositionals:true,
  options:{all:{type:'boolean'}, concurrency:{type:'string', default:'6'}, rate:{type:'string', default:'10'}, checkpoint:{type:'string'}},
});
assert.equal(positionals.length, 1, 'Indiquer uniquement l’origine HTTPS du site');
const site = new URL(positionals[0]);
const origin = site.origin;
const canonical = 'https://flex-web.fr';
const immutablePreview = /^[0-9a-f]{24}--flex-webb\.netlify\.app$/.test(site.hostname);
assert.ok(site.protocol === 'https:' && site.href === origin + '/' && (immutablePreview || origin === canonical),
  'Indiquer flex-web.fr ou le permalien immuable du déploiement Netlify');
const concurrency = Number(values.concurrency);
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 12, 'Concurrence autorisée : 1 à 12');
const rate = Number(values.rate);
assert.ok(Number.isInteger(rate) && rate >= 1 && rate <= 16, 'Débit autorisé : 1 à 16 requêtes par seconde');
const checkpoint = values.checkpoint;
assert.ok(!checkpoint || (immutablePreview && values.all), 'La reprise est réservée à un aperçu immuable en mode --all');

const {pairs, bytes} = await buildLegacyRedirects();
const prioritySource = '/global/ai-automation-en/la-chapelle-des-fougeretz-35059/';
const sample = new Map([[prioritySource, pairs.get(prioritySource)]]);
assert.ok(sample.get(prioritySource), prioritySource);
for (const family of ['websites-en', 'ai-automation-en']) {
  const entries = [...pairs].filter(([from]) => from.startsWith('/global/' + family + '/')).sort();
  for (const i of [0, Math.floor(entries.length / 2), entries.length - 1]) sample.set(...entries[i]);
}
const priorityPages = ['/', '/en/', '/creation-site-internet/', '/creation-application-mobile/',
  '/automatisation-ia/', '/pricing/', '/contact/', '/en/contact/'];
const genuine404s = ['/global/seo-geo-audit/les-nouillers-17266/', '/global/ai-automation-en/plaisance-32319/',
  '/global/websites-en/commune-inexistante-00000/'];
const transient = new Set([403, 408, 429, 500, 502, 503, 504]);
let cooldown = 0;
let retries = 0;
let nextRequest = 0;
let refusal;
async function throttle() {
  for (;;) {
    if (refusal) throw refusal;
    const wait = Math.max(cooldown, nextRequest) - Date.now();
    if (wait <= 0) {
      nextRequest = Date.now() + Math.ceil(1000 / rate);
      return;
    }
    await delay(wait);
  }
}
async function request(path, method, check) {
  for (let attempt = 1; ; attempt++) {
    await throttle();
    let response;
    try {
      response = await fetch(origin + path, {method, redirect:'manual', signal:AbortSignal.timeout(30000),
        headers:{'User-Agent':'Flex-Web release redirect verification/1.0'}});
      const refused = response.status === 403 || response.status === 429;
      if (refused && attempt >= 3) {
        refusal = new Error(path + ' refus HTTP ' + response.status + ' persistant : contrôle interrompu');
        throw refusal;
      }
      if (!transient.has(response.status) || attempt === 4) return await check(response);
      const hint = response.headers.get('retry-after');
      const wait = hint && (/^\d+$/.test(hint) ? Number(hint) * 1000 : Date.parse(hint) - Date.now());
      if (refused || wait > 0) {
        const pause = Math.max(wait || 0, refused ? 30000 * attempt : 0);
        cooldown = Math.max(cooldown, Date.now() + pause);
      }
    } catch (error) {
      if (error === refusal || error.code === 'ERR_ASSERTION' || attempt === 4) throw error;
    } finally {
      await response?.body?.cancel();
    }
    retries++;
    await delay(400 * 2 ** (attempt - 1));
  }
}

async function redirect(from, to, method = 'HEAD') {
  await request(from, method, response => {
    assert.equal(response.status, 301, from + ' HTTP ' + response.status + ', attendu 301');
    const raw = response.headers.get('location');
    assert.ok(raw, from + ' sans Location');
    const location = new URL(raw, origin + from);
    assert.ok([origin, canonical].includes(location.origin) && !location.username && !location.password && !location.hash,
      from + ' Location inattendue : ' + location.href);
    assert.equal(location.pathname + location.search, to, from + ' Location : ' + location.href);
  });
}

async function htmlHead(response, path) {
  assert.match(response.headers.get('content-type') || '', /^text\/html\b/i, path + ' type de contenu');
  const chunks = [];
  const reader = response.body.getReader();
  let length = 0;
  let tail = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      const buffer = Buffer.from(value);
      length += buffer.length;
      chunks.push(buffer);
      const end = tail + buffer.toString('latin1');
      if (/<\/head\s*>/i.test(end)) return parse(Buffer.concat(chunks).toString('utf8').split(/<\/head\s*>/i)[0] + '</head>');
      assert.ok(length < 512 * 1024, path + ' en-tête HTML trop long');
      tail = end.slice(-16);
    }
    assert.fail(path + ' fin de head absente');
  } finally {
    reader.releaseLock();
  }
}

async function page(path) {
  await request(path, 'GET', async response => {
    assert.equal(response.status, 200, path + ' HTTP ' + response.status + ', attendu 200 direct');
    if (!immutablePreview) assert.doesNotMatch(response.headers.get('x-robots-tag') || '', /\b(noindex|none)\b/i, path);
    const doc = await htmlHead(response, path);
    const html = doc.childNodes.find(n => n.tagName === 'html');
    const head = html?.childNodes.find(n => n.tagName === 'head');
    assert.equal(html?.attrs.find(a => a.name === 'lang')?.value, expectedLanguage(path), path + ' langue');
    const canonicals = [];
    for (const node of head?.childNodes || []) {
      const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
      if (node.tagName === 'link' && (attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')) canonicals.push(attrs.href);
      if (node.tagName === 'meta' && ['robots', 'bingbot', 'googlebot'].includes((attrs.name || '').toLowerCase()))
        assert.doesNotMatch(attrs.content || '', /\b(noindex|none)\b/i, path);
    }
    assert.deepEqual(canonicals, [canonical + path], path + ' canonique');
  });
}

for (const path of genuine404s) {
  assert.ok(!pairs.has(path), 'La 404 attendue est déclarée dans les règles : ' + path);
  await request(path, 'GET', r => assert.equal(r.status, 404, path + ' HTTP ' + r.status));
}
for (const path of priorityPages) await page(path);
const query = '?utm_source=redirect-verification&language=en';
const target = sample.get(prioritySource);
await redirect(prioritySource.slice(0, -1), target, 'GET');
await redirect(prioritySource + query, target + query, 'GET');

const cases = values.all ? pairs : sample;
const signature = origin + ':' + createHash('sha256').update(bytes).digest('hex') + ':v1';
let passed = new Set();
if (checkpoint) {
  try {
    const prior = JSON.parse(await readFile(checkpoint, 'utf8'));
    assert.equal(prior.signature, signature, 'Ce point de reprise appartient à un autre déploiement ou jeu de règles');
    assert.ok(Array.isArray(prior.passed) && prior.passed.every(path => cases.has(path)), 'Point de reprise invalide');
    passed = new Set(prior.passed);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const resumed = passed.size;
const pending = [...cases].filter(([from]) => !passed.has(from));
const failures = [];
let next = 0;
let checked = 0;
let saving = Promise.resolve();
async function save() {
  if (!checkpoint) return;
  const snapshot = JSON.stringify({signature, passed:[...passed]});
  saving = saving.then(async () => {
    const tmp = checkpoint + '.' + process.pid + '.tmp';
    await writeFile(tmp, snapshot);
    await rename(tmp, checkpoint);
  });
  return saving;
}
async function worker() {
  while (!refusal && next < pending.length) {
    const [from, to] = pending[next++];
    try {
      await redirect(from, to);
      await page(to);
      passed.add(from);
    } catch (error) {
      failures.push({from, to, reason:error.message});
      if (failures.length <= 8) console.error(from, error.message);
    }
    if (++checked % 250 === 0) {
      console.log(resumed + checked + '/' + cases.size + ' règles traitées, ' + failures.length + ' échec(s)');
      await save();
    }
  }
}
await Promise.all(Array.from({length:concurrency}, worker));
await save();
console.log(JSON.stringify({origin, mode:values.all ? 'exhaustif' : 'échantillon', rules:cases.size, passed:passed.size,
  resumed, unattempted:pending.length - next, priorityPages:priorityPages.length, genuine404s:genuine404s.length,
  slashAndQuery:2, retries, failures}, null, 2));
if (passed.size !== cases.size) process.exitCode = 1;
