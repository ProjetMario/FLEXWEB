import {test} from 'node:test';
import assert from 'node:assert/strict';
import {territoryRecords,territoryDepartments} from '../../src/lib/seo/territorial-directory.mjs';
import {prepareSearchRecords,searchTerritories,normalizeQuery} from '../../src/lib/seo/territorial-search.mjs';
const records=prepareSearchRecords(territoryRecords());
test('directory retains all 9994 codes once and matches department totals',()=>{
 assert.equal(records.length,9994);assert.equal(new Set(records.map(r=>r.code)).size,9994);
 assert.equal(territoryDepartments().reduce((n,g)=>n+g.items.length,0),9994);
});
test('accents, postcode, Corsican code and overseas code resolve correctly',()=>{
 assert(searchTerritories(records,{q:'chambery'}).items.some(r=>r.code==='73065'));
 assert(searchTerritories(records,{q:'73000'}).items.some(r=>r.code==='73065'));
 assert.deepEqual(searchTerritories(records,{q:'2A004'}).items.map(r=>r.code),['2A004']);
 const overseas=searchTerritories(records,{q:'97411'}).items;assert(overseas.some(r=>r.code==='97411'));assert(overseas.every(r=>r.code==='97411'||r.postalCodes.includes('97411')));
 assert.equal(normalizeQuery('Saint-Denis'),normalizeQuery('saint denis'));
});
test('homonyms can be narrowed by department without losing other records',()=>{
 const all=searchTerritories(records,{q:'Saint Denis',pageSize:50});
 const filtered=searchTerritories(records,{q:'Saint Denis',department:'974'});
 assert(all.total>filtered.total);assert.deepEqual(filtered.items.map(r=>r.code),['97411']);
});
test('issue filters are cumulative and pagination never repeats records',()=>{
 const first=searchTerritories(records,{department:'73',issue:'sharedPostal',pageSize:10});
 const second=searchTerritories(records,{department:'73',issue:'sharedPostal',pageSize:10,page:2});
 assert(first.total>10);assert(first.items.every(r=>r.departmentCode==='73'&&r.flags.sharedPostal));
 assert(second.items.every(r=>!first.items.some(p=>p.code===r.code)));
 const last=searchTerritories(records,{department:'73',issue:'sharedPostal',page:999999,pageSize:10});assert.equal(last.page,last.pages);
});
test('empty results and invalid pagination stay predictable',()=>{
 const none=searchTerritories(records,{q:'zzzznotacommunexxxx',page:55});assert.equal(none.total,0);assert.equal(none.page,1);assert.equal(none.pages,1);
 assert.equal(searchTerritories(records,{page:-1}).page,1);
 assert.equal(searchTerritories(records,{pageSize:999}).items.length,50);
});

test('exact commune names appear before department-only matches',()=>{
 const records=prepareSearchRecords(territoryRecords());
 const result=searchTerritories(records,{q:'Saint-Denis'});
 assert(result.items.length>1);
 assert.equal(result.items[0].name,'Saint-Denis');
 assert.equal(result.items.findIndex(r=>r.name==='Aubervilliers'),-1);
});
