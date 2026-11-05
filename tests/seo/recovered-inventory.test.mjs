import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {territorialUrls} from '../../src/lib/seo/territorial-publication.mjs';
import {franceUrls,franceNewEntries} from '../../src/lib/seo/france-communes.mjs';
import {englishUrls} from '../../src/lib/seo/english.mjs';
import {draftEntries,additionalEntries,draftPath} from '../../src/lib/seo/territorial-drafts.mjs';

const inventory=JSON.parse(gunzipSync(readFileSync('seo/inventories/published-2026-10-22-and-2026-11-05.json.gz')));
const current=new Set(inventory.current.paths);
const historic=new Set(inventory.historical.paths);
const expected=new Set([...current,...historic]);
const territorial=territorialUrls().map(entry=>entry.url);
const france=franceUrls().map(entry=>entry.url);
const english=englishUrls().map(entry=>entry.url);
const generated=new Set([...current,...territorial,...france,...english,'/application-metier-sur-mesure/']);

test('published inventory is a complete frozen union and only historical routes are restored',()=>{
 assert.equal(current.size,inventory.current.paths.length);
 assert.equal(historic.size,inventory.historical.paths.length);
 assert.equal(expected.size,151473);
 assert.deepEqual([...expected].filter(route=>!generated.has(route)),[]);
 assert.deepEqual([...generated].filter(route=>!expected.has(route)),[]);
});

test('territorial paths are unique across preserved and recovered sources',()=>{
 const pages=[...draftEntries(),...additionalEntries(),...franceNewEntries()];
 const paths=pages.map(entry=>draftPath(entry.axis,entry.commune));
 assert.equal(new Set(paths).size,paths.length);
 for(const route of ['/territoires/automatisation/locronan-29134/','/territoires/sites/brailly-cornehotte-80133/','/territoires/applications/beuvry-la-foret-59080/','/territoires/crm/lezennes-59346/'])assert(paths.includes(route),route);
});

test('English historical pages, directories and current paths are accounted for',()=>{
 const englishSet=new Set(english);
 assert(englishSet.has('/en/locations/crm/grenoble-38185/'));
 assert(englishSet.has('/en/locations/ai-automation/brezins-38058/'));
 assert(englishSet.has('/en/locations/'));
 assert.equal(new Set(territorial).size,territorial.length);
 assert.equal(new Set(france).size,france.length);
 assert.equal(new Set(english).size,english.length);
});
