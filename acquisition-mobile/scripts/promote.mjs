import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { api, baseId as designBaseId, cache, put, root, sha, site } from './baseline.mjs';
import { assertFunctions, digestOf, functionPayload } from './deploys.mjs';
import { filesOf, rawFile, waitDeploy, netJSON, parallel, request } from '../catalogue/netlify.mjs';

const run = promisify(execFile);
const [mode, approvedId] = process.argv.slice(2);
assert.ok(['--check', '--publish'].includes(mode), 'Indiquer --check ou --publish et l’identifiant approuvé');
const design = JSON.parse(await readFile(join(root, 'redesign/release-candidate.json'), 'utf8'));
const legacy = JSON.parse(await readFile(join(root, 'catalogue/legacy-release-candidate.json'), 'utf8'));
let contact;
try {
  contact = JSON.parse(await readFile(join(root, 'redesign/contact/release-candidate.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
assert.match(approvedId || '', /^[a-f0-9]{24}$/);
const receipt = [design, legacy, contact].find(item => item?.id === approvedId);
assert.ok(receipt, 'Identifiant différent des aperçus contrôlés sur cette révision Git');
const routingOnly = receipt === legacy;
const contactRelease = receipt === contact;
const baseId = receipt === design ? designBaseId : receipt.baseId;
if (routingOnly) assert.equal(receipt.sourceDesignId, design.id);
assert.equal(receipt.url, 'https://' + approvedId + '--flex-webb.netlify.app');
const catalogue = JSON.parse(await readFile(join(root, 'catalogue/release-candidate.json'), 'utf8'));
assert.equal(receipt.sourceCatalogueId, catalogue.id, 'Catalogue source différent du catalogue certifié');
assert.equal(baseId, receipt.baseId);
assert.equal(receipt.routes, 151507);
assert.equal(receipt.sitemaps, 85);
const current = async () => (await api('/sites/' + site)).published_deploy;
const fetchDeploy = id => api('/deploys/' + id);
const post = path => api(path, { method: 'POST' }, true);
// Netlify detects forms across the complete archive before serving this deploy.
// Keep the published site locked until the selected preview is ready and verified.
if (contactRelease && mode === '--check') {
  console.log('Attente du traitement du formulaire dans l’aperçu Netlify ' + approvedId);
  await waitDeploy(approvedId, 5400);
}
const [base, preview, live] = await Promise.all([fetchDeploy(baseId), fetchDeploy(approvedId), current()]);
for (const deploy of [base, preview, live]) assert.equal(deploy.site_id, site);
assert.equal(preview.context, 'deploy-preview');
assert.equal(preview.state, 'ready');
assert.equal(preview.summary.status, 'ready');
assert.equal(preview.branch, 'main');
const files = await filesOf(approvedId);
assert.equal(Object.keys(files).length, receipt.files);
assert.equal(digestOf(files), receipt.digest, 'Inventaire différent de l’aperçu validé');
let contactEdge;
if (contactRelease) {
  const {inspectContactRelease} = await import('../redesign/contact/promotion.mjs');
  contactEdge = await inspectContactRelease({base, preview, receipt, legacy, source:await filesOf(baseId), files});
} else {
  assertFunctions(base, preview);
}
if (routingOnly) {
  // The sole change to the certified site is the compiled routing configuration.
  const source = await filesOf(baseId);
  assert.equal(digestOf(source), design.digest);
  assert.deepEqual(Object.keys(files).sort(), Object.keys(source).sort());
  const changed = Object.keys(source).filter(path => source[path] !== files[path]);
  assert.deepEqual(changed, ['/netlify.toml']);
  const {verifyCompiledRedirects} = await import('../catalogue/legacy-release.mjs');
  await verifyCompiledRedirects(await rawFile(baseId, '/netlify.toml'), await rawFile(approvedId, '/netlify.toml'));
}
const title = 'Atelier Flex-Web — ' + approvedId;
assert.ok(live.id === baseId || live.title === title, 'Une autre version a été publiée. Réintégrer ses modifications avant de publier.');
await run(process.execPath, [join(root, 'catalogue/check.mjs'), receipt.url, '--exact'], {timeout:240_000});

async function verifyCopy(candidate) {
  assert.equal(candidate.site_id, site);
  assert.equal(candidate.context, 'production');
  assert.equal(candidate.branch, 'main');
  assert.equal(candidate.state, 'ready');
  assertFunctions(preview, candidate);
  if (contactRelease) assert.deepEqual(functionPayload(candidate), functionPayload(preview));
  assert.deepEqual(await filesOf(candidate.id), files);
  const rules = deployment => deployment.summary.messages.filter(m => /redirect rules|header rule|functions deployed/.test(m.title)).map(m => [m.title, m.type]).sort();
  assert.deepEqual(rules(candidate), rules(preview));
}
if (live.id !== baseId) await verifyCopy(live);
async function checkContact(host, expectedFormId) {
  const forms = (await netJSON('/sites/' + site + '/forms')).filter(form => form.name === 'flexweb-contact' && form.site_id === site);
  assert.equal(forms.length, 1, 'Formulaire de contact non enregistré chez Netlify');
  assert.match(forms[0].id, /^[a-f0-9]{24}$/);
  if (expectedFormId) assert.equal(forms[0].id, expectedFormId, 'Netlify a remplacé le formulaire enregistré');
  assert.deepEqual(forms[0].fields.map(field => field.name).sort(), ['bot-field','consent','email','language','message','name','topic']);
  const {assertServedHTML} = await import('../redesign/contact/promotion.mjs');
  await Promise.all(['/contact/', '/en/contact/'].map(async route => {
    const response = await fetch(new URL(route,host), {redirect:'error', signal:AbortSignal.timeout(45_000)});
    assert.equal(response.status, 200, route);
    await assertServedHTML(approvedId, files, route + 'index.html', route, Buffer.from(await response.arrayBuffer()));
  }));
  const result = await run(process.execPath, [join(root,'redesign/contact/public-check.mjs'), host, approvedId], {timeout:600_000});
  console.log(result.stdout.trim());
  return forms[0].id;
}
const formId = contactRelease ? await checkContact(receipt.url, receipt.formId) : undefined;
if (mode === '--check') {
  console.log('Promotion vérifiable :', approvedId, receipt.files, 'fichiers et fonctions validés. Production :', live.id);
  process.exit(0);
}
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.equal(process.env.GITHUB_REPOSITORY.toLowerCase(), 'projetmario/flexweb');
const head = (await run('gh', ['api', 'repos/' + process.env.GITHUB_REPOSITORY + '/commits/main', '--jq', '.sha'])).stdout.trim();
assert.equal(head, process.env.GITHUB_SHA, 'main a changé depuis la demande de publication');

async function waitPublished(id) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await current();
    if (status.id === id) return status;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Publication Netlify non confirmée pour ' + id);
}

async function restoreLock(id) {
  const status = await current();
  assert.equal(status.id, id, 'Une autre version est en production');
  if (!!status.locked !== receipt.productionLocked) {
    await post('/deploys/' + id + (receipt.productionLocked ? '/lock' : '/unlock'));
    assert.equal(!!(await current()).locked, receipt.productionLocked);
  }
}

async function publicChecks() {
  const url = 'https://flex-web.fr';
  const options = { timeout: 600_000 };
  console.log((await run(process.execPath,[join(root,'catalogue/check.mjs'),url,'--exact'],options)).stdout.trim());
  console.log((await run(process.execPath,[join(root,'catalogue/public.mjs')],options)).stdout.trim());
  for (const script of ['scripts/verify-pages.mjs', 'scripts/verify-quote.mjs', 'redesign/verify.mjs']) {
    const args = [join(root, script), url];
    if (script === 'redesign/verify.mjs' && !contactRelease) args.push('--legacy-contact');
    const result = await run(process.execPath, args, options);
    console.log(result.stdout.trim());
  }
}

let candidate;
let lockMayHaveChanged = false;
try {
  if (live.id === baseId) {
    const before = await current();
    assert.equal(before.id, baseId, 'Une publication concurrente a modifié le site');
    assert.equal(!!before.locked, receipt.productionLocked, 'L’état du verrou a changé');
    if (before.locked) {
      lockMayHaveChanged = true;
      await post('/deploys/' + baseId + '/unlock');
    }
    const unlocked = await current();
    assert.equal(unlocked.id, baseId, 'Une autre version est passée en production au déverrouillage');
    assert.ok(!unlocked.locked, 'Déverrouillage Netlify non confirmé');
    candidate = await api('/sites/' + site + '/deploys?title=' + encodeURIComponent(title), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ async: true, draft: false, branch: 'main', files, ...functionPayload(preview),
        ...(contactRelease ? {edge_functions:receipt.edgeFunctions} : {}),
      }),
    });
    assert.equal(candidate.site_id, site);
    const id=candidate.id;
    const byDigest=new Map(Object.entries(files).map(([path,hash])=>[hash,path]));
    const uploaded=new Set();
    // The site-scoped endpoint carries Netlify's authoritative missing-file list.
    for (let i=0; i<720; i++) {
      candidate=await netJSON('/sites/'+site+'/deploys/'+id);
      assert.ok(!['error','rejected','canceled'].includes(candidate.state),candidate.error_message||candidate.state);
      if (!contactRelease) {
        assert.deepEqual(candidate.required_functions||[],[]);
        assert.deepEqual(candidate.required_edge_functions||[],[]);
      }
      if (['uploaded','processing','ready'].includes(candidate.state)) break;
      if (['prepared','uploading'].includes(candidate.state)) {
        if (contactRelease) {
          const {sendRequiredBundles} = await import('../redesign/contact/promotion.mjs');
          await sendRequiredBundles({candidate, base, receipt, edgeBytes:contactEdge, sent:uploaded, upload:async (path, bytes) => {
            const response = await request('/deploys/' + id + path, {method:'PUT', headers:{'Content-Type':'application/octet-stream'}, body:bytes});
            await response.arrayBuffer();
          }});
        }
        const remaining=[...new Set(candidate.required||[])].filter(hash=>!uploaded.has(hash));
        await parallel(remaining,5,async digest=>{
          const path=byDigest.get(digest);
          assert.ok(path,'Fichier absent de l’aperçu approuvé');
          const bytes=await rawFile(approvedId,path);
          assert.equal(sha(bytes),digest);
          const remotePath=path.split('/').map(encodeURIComponent).join('/');
          const res=await request('/deploys/'+id+'/files'+remotePath,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
          await res.arrayBuffer();
          uploaded.add(digest);
        });
      }
      assert.ok(i<719,'Traitement Netlify prolongé, vérifier le déploiement '+id);
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    candidate=await waitDeploy(id,3600);
    await waitPublished(id);
    await restoreLock(id);
    await verifyCopy(candidate);
  } else {
    candidate = live;
  }
  await restoreLock(candidate.id);
  await publicChecks();
  if (contactRelease) await checkContact('https://flex-web.fr', formId);
  if (routingOnly || contactRelease) {
    const result = await run(process.execPath, [join(root, 'catalogue/verify-legacy-redirects.mjs'), 'https://flex-web.fr'], {timeout:300_000});
    console.log(result.stdout.trim());
  }
  assert.equal((await current()).id, candidate.id);
  const result = { approvedId, productionId: candidate.id, previousId: baseId, digest: receipt.digest, files: receipt.files, ...(contactRelease ? {formId} : {}) };
  await put(cache, 'production.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  // Restore the prior auto-publishing policy even if the deploy or its public check failed.
  if (lockMayHaveChanged || candidate) {
    const actual=await current();
    // Reapply the initial site locking policy to the active version, even if Netlify
    // published a queued release while unlocked. Never replace that release here.
    await restoreLock(actual.id);
  }
}
