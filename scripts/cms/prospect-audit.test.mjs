import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {auditProspects} from '../prospects/audit.mjs';

async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'flexweb-prospect-audit-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const dir of ['src/pages','src/content/locations','src/data','public','cms','dist/demarrer','dist/dupont-annecy'])await mkdir(path.join(root,dir),{recursive:true});
  const slug='dupont-annecy';
  await writeFile(path.join(root,'src/data/prospects.json'),JSON.stringify([{slug,name:'Dupont'}]));
  await writeFile(path.join(root,'src/pages/index.astro'),'');
  await writeFile(path.join(root,'public/_redirects'),'');
  await writeFile(path.join(root,'cms/baseline.json.gz'),gzipSync(JSON.stringify({entries:[{path:'/'}]})));
  await writeFile(path.join(root,'dist/index.html'),'<main>Accueil</main>');
  await writeFile(path.join(root,'dist/demarrer/index.html'),'<main>Devis</main>');
  const links=[['site','essentielle'],['seo','visibilite'],['automation','crm-automation']].map(([service,offre])=>`<a href="/demarrer/?service=${service}&amp;offre=${offre}&amp;maquette=${slug}">Choisir</a>`).join('');
  const page=path.join(root,'dist',slug,'index.html');
  await writeFile(page,`<!doctype html><html><head><title>Dupont</title><meta name="robots" content="noindex,nofollow"><meta name="flexweb-content-kind" content="prospect-mockup"><link rel="canonical" href="https://flex-web.fr/${slug}/"></head><body><p>Flex-Web — maquette non officielle</p><main><h1>Dupont</h1>${links}</main></body></html>`);
  const sitemap=path.join(root,'dist/sitemap.xml');
  await writeFile(sitemap,'<urlset><url><loc>https://flex-web.fr/</loc></url></urlset>');
  const changePage=async (from,to)=>writeFile(page,(await readFile(page,'utf8')).replace(from,to));
  return {root,page,sitemap,changePage};
}
test('mockups are separately audited and remain absent from public sitemap',async t=>{
  const f=await fixture(t);assert.deepEqual(await auditProspects({root:f.root}),{status:'passed',pages:1,noindexPages:1,sitemapEntries:0,routeCollisions:0});
});
test('missing noindex blocks the build',async t=>{
  const f=await fixture(t);await f.changePage('noindex,nofollow','index,nofollow');await assert.rejects(auditProspects({root:f.root}),/noindex for Google/);
});
test('mockup inclusion in sitemap blocks the build',async t=>{
  const f=await fixture(t);await writeFile(f.sitemap,'<urlset><url><loc>https://flex-web.fr/dupont-annecy/</loc></url></urlset>');await assert.rejects(auditProspects({root:f.root}),/public sitemap/);
});
test('collision with an existing static route blocks the build',async t=>{
  const f=await fixture(t);await writeFile(path.join(f.root,'src/pages/dupont-annecy.astro'),'');await assert.rejects(auditProspects({root:f.root}),/collides/);
});
test('collision with a CMS route or an old redirect blocks the build',async t=>{
  const f=await fixture(t);await writeFile(path.join(f.root,'public/_redirects'),'/dupont-annecy/ /pricing/ 301');await assert.rejects(auditProspects({root:f.root}),/collides/);
  await writeFile(path.join(f.root,'public/_redirects'),'');await writeFile(path.join(f.root,'cms/baseline.json.gz'),gzipSync(JSON.stringify({entries:[{path:'/dupont-annecy/'}]})));await assert.rejects(auditProspects({root:f.root}),/collides/);
});
test('client contact and lead collection cannot become live inside a mockup',async t=>{
  const f=await fixture(t);await f.changePage('</main>','<a href="tel:+33123456789">Appeler</a></main>');await assert.rejects(auditProspects({root:f.root}),/live prospect contact/);
  await f.changePage('<a href="tel:+33123456789">Appeler</a>','<form action="/api/contact"><input name="email"></form>');await assert.rejects(auditProspects({root:f.root}),/must not collect/);
});
test('pack links must retain company and service preselection',async t=>{
  const f=await fixture(t);await f.changePage('maquette=dupont-annecy','maquette=other');await assert.rejects(auditProspects({root:f.root}),/attribution/);
});
