import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {draftData, draftEntries, draftPath} from '../../src/lib/seo/territorial-drafts.mjs';
import {territoryDepartments, territoryRegions} from '../../src/lib/seo/territorial-directory.mjs';
import {territorialDossier, territorialDossiersForDepartment} from '../../src/lib/seo/territorial-editorial.mjs';
import {territorialPublicationDate, territorialUrls} from '../../src/lib/seo/territorial-publication.mjs';

test('regional navigation keeps each department and all commune service routes',()=>{
 const regions=territoryRegions();
 const departments=regions.flatMap(region=>region.departments);
 assert.equal(departments.length,107);
 assert.equal(new Set(departments.map(d=>d.code)).size,107);
 assert.deepEqual(departments.map(d=>d.code).sort(),territoryDepartments().map(d=>d.code).sort());
 const actual=new Set(departments.flatMap(d=>d.items.flatMap(c=>['sites','automatisation'].map(axis=>`/territoires/${axis}/${c.slug}/`))));
 assert.deepEqual(actual,new Set(draftEntries().map(e=>draftPath(e.axis,e.commune))));
 for(const region of regions)for(const department of region.departments){
  assert(draftData().communes.filter(c=>c.departmentCode===department.code).every(c=>c.regionCode===region.code));
 }
});

test('one reviewed local addition changes only its own fiche lastmod',()=>{
 const fiches=territorialUrls().filter(entry=>entry.family.startsWith('fiches-'));
 assert.equal(fiches.length,19988);
 const modified=fiches.filter(entry=>entry.lastmod!==territorialPublicationDate);
 assert.deepEqual(modified.map(entry=>entry.url),['/territoires/sites/montalieu-vercieu-38247/']);
 assert.equal(modified[0].lastmod,territorialDossier('sites','38247').verifiedAt);
 assert.equal(territorialDossier('automatisation','38247'),undefined);
 assert.equal(territorialDossier('sites','00000'),undefined);
});

test('curated local links point to published catalogue identities',()=>{
 const dossier=territorialDossier('sites','38247');
 const paths=new Set(draftEntries().map(e=>draftPath(e.axis,e.commune)));
 for(const link of dossier.links.filter(link=>link.href.startsWith('/territoires/')))assert(paths.has(link.href),link.href);
 const isere=territoryDepartments().find(d=>d.code==='38');
 assert.deepEqual(territorialDossiersForDepartment('sites',isere.items).map(({commune})=>commune.code),['38247']);
 assert.equal(territorialDossiersForDepartment('automatisation',isere.items).length,0);
});

test('navigation lastmod changes only for regional directory and promoted Isere dossier',()=>{
 const navigation=territorialUrls().filter(entry=>entry.family==='catalogue');
 assert.deepEqual(navigation.filter(entry=>entry.lastmod!==territorialPublicationDate).map(entry=>[entry.url,entry.lastmod]),[
  ['/territoires/','2026-10-08'],
  ['/territoires/departements/38/','2026-10-08'],
 ]);
});

test('Montalieu metadata stays concise including the brand while retaining the detailed H1',()=>{
 const dossier=territorialDossier('sites','38247');
 // BaseHead normalizes an optional brand suffix then appends this single one.
 const renderedTitle=dossier.seoTitle.replace(/\s*[—–|]\s*flex-web\s*$/i,'')+' — Flex-Web';
 assert(renderedTitle.length>=50&&renderedTitle.length<70);
 assert(dossier.description.length>=140&&dossier.description.length<=160);
 assert.notEqual(dossier.seoTitle,dossier.title);
 const page=readFileSync(new URL('../../src/pages/territoires/[axe]/[slug].astro',import.meta.url),'utf8');
 assert.match(page,/<ResourceLayout title=\{editorial\?\.seoTitle\?\?editorial\?\.title\?\?content\.title\}/);
 assert.match(page,/<h1>\{editorial\?\.title\?\?content\.title\}<\/h1>/);
});
