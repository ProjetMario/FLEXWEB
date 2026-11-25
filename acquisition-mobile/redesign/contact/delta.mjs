import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {site, sha} from '../../scripts/baseline.mjs';
import {functionPayload, digestOf} from '../../scripts/deploys.mjs';
import {netJSON, parallel, request, waitDeploy} from '../../catalogue/netlify.mjs';

export const project = '/sites/' + site;
export const edgeFolder = '/.netlify/internal/edge-functions/';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = body => ({headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const readSite = () => netJSON(project);

export async function checkReceiver() {
  const [forms, hook] = await Promise.all([netJSON(project + '/forms'),netJSON('/hooks/6b057ba1cee5f6220f5e9fdc')]);
  assert.deepEqual(forms.map(f=>f.name),['flexweb-contact']);
  assert.equal(forms[0].id,'6b057b8e51b2624e2817882d');
  assert.deepEqual(forms[0].fields.map(f=>f.name).sort(),['bot-field','consent','email','language','message','name','topic']);
  assert.equal(hook.form_id,forms[0].id);
  assert.ok(!hook.disabled && !hook.restricted && !hook.pending_confirmation && !hook.data?.pending_confirmation);
}

export function applyPatch(source, receipt) {
  assert.equal(digestOf(source),receipt.before);
  const files={...source};
  for(const [path, {from,to}] of Object.entries(receipt.changes)) {
    assert.equal(source[path] ?? null,from,path);
    assert.match(to,/^[a-f0-9]{40}$/);
    // No catalogue HTML, sitemap, routing file, image or business function can be replaced.
    assert.ok(/^\/(?:en\/)?contact\/index\.html$/.test(path) || /^\/(?:llms(?:-full)?|ai-overview)\.txt$/.test(path) ||
      /^\/(?:_astro|studio-redesign)\/[^/]+\.m?js$/.test(path) ||
      (path.startsWith(edgeFolder) && [receipt.edge + '.eszip','manifest.json'].includes(path.slice(edgeFolder.length))),path);
    assert.notEqual(from,to,path);
    files[path]=to;
  }
  assert.equal(digestOf(files),receipt.after);
  return files;
}

async function setDiscovery(settings, ignore) {
  await netJSON(project,{method:'PATCH',...json({processing_settings:{...settings,ignore_html_forms:ignore}})});
  assert.equal((await readSite()).processing_settings.ignore_html_forms,ignore);
}

// The receiving form already runs in its own latest successful branch deploy.
// This catalogue delta contains no new Forms definition. Re-enable discovery
// before returning, including on error; never touch stored responses or hooks.
export async function deployDelta({base,files,receipt,draft,getBytes,locked=true,baseHasEdge=false,titlePrefix='Formulaires publics — correctif différentiel '}) {
  const before=await readSite();
  assert.equal(before.published_deploy.id,receipt.base);
  assert.equal(base.id,receipt.base);
  assert.equal(base.site_id,site);
  assert.equal(!!before.published_deploy.locked,locked);
  assert.deepEqual(base.available_functions.map(f=>f.n).sort(),['automation','automation-clock']);
  assert.equal(!!base.edge_functions_present,baseHasEdge);
  const settings=before.processing_settings;
  assert.equal(settings.ignore_html_forms,false);
  await checkReceiver();
  const byHash=new Map(Object.entries(receipt.changes).map(([path,change])=>[change.to,path]));
  let id;
  try {
    await setDiscovery(settings,true);
    const title=titlePrefix + receipt.after;
    const created=await netJSON(project+'/deploys?title='+encodeURIComponent(title),{method:'POST',...json({
      draft,async:true,branch:'main',files,...functionPayload(base),edge_functions:{eszip2:receipt.edge},
    })});
    id=created.id;
    assert.equal(created.site_id,site);
    console.log('Correctif Netlify',id,draft?'aperçu':'production');
    const sent=new Set();
    for(let n=0;n<120;n++) {
      const d=await netJSON(project+'/deploys/'+id);
      assert.ok(!['error','rejected','canceled'].includes(d.state),d.error_message||d.state);
      assert.deepEqual(d.required_functions||[],[],'Fonction métier demandée de nouveau');
      if(['uploaded','processing','ready'].includes(d.state)) break;
      if(['prepared','uploading'].includes(d.state)) {
        for(const e of d.required_edge_functions||[]) {
          assert.equal(e,receipt.edge);
          if(!sent.has(e)){
            const bytes=await getBytes(edgeFolder+e+'.eszip');assert.equal(sha256(bytes),e);
            const r=await request('/deploys/'+id+'/edge_functions/'+e,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
            await r.arrayBuffer();sent.add(e);
          }
        }
        await parallel([...new Set(d.required||[])].filter(h=>!sent.has(h)),5,async h=>{
          const path=byHash.get(h);assert.ok(path,'Netlify demande un fichier hors correctif. Aucun renvoi du catalogue.');
          const bytes=await getBytes(path);assert.equal(sha(bytes),h,path);
          const remote=path.split('/').map(encodeURIComponent).join('/');
          const res=await request('/deploys/'+id+'/files'+remote,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
          await res.arrayBuffer();sent.add(h);
        });
      }
      await sleep(1500);
    }
    const ready=await waitDeploy(id,360);
    assert.equal(ready.context,draft?'deploy-preview':'production');
    assert.equal(ready.edge_functions_present,true);
    assert.deepEqual(functionPayload(ready),functionPayload(base));
    assert.deepEqual(ready.server,base.server);
    const rules=d=>d.summary.messages.filter(m=>/redirect rules|header rule/i.test(m.title)).map(m=>[m.title,m.type]).sort();
    assert.deepEqual(rules(ready),rules(base));
    console.log('Objets transférés',sent.size,'dont 0 page de catalogue');
    return ready;
  } finally {
    const actual=await readSite();
    if(actual.processing_settings.ignore_html_forms)await setDiscovery(actual.processing_settings,false);
    await checkReceiver();
  }
}
