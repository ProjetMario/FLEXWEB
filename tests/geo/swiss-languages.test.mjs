import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates,swissTranslations,swissLanguages,swissLanguagePath,locationLanguage,localizedSwissRegion} from '../../src/lib/seo-expansion/fr-ch.mjs';
test('each Swiss location and audience has exactly three unique language routes preserving its original route',()=>{
 const base=candidates(),translated=swissTranslations();assert.equal(base.length,30000);assert.equal(translated.length,8440);
 const paths=new Set([...base,...translated].map(x=>x.path));assert.equal(paths.size,38440);
 for(const item of base.filter(x=>x.location.country==='CH')){
  assert.equal(swissLanguagePath(item.audience,item.location,locationLanguage(item.location)),item.path);
  const local=swissLanguages.map(lang=>swissLanguagePath(item.audience,item.location,lang));assert.equal(new Set(local).size,3);
  for(const p of local)assert(paths.has(p));
 }
 assert.throws(()=>swissLanguagePath('particuliers',base.find(x=>x.location.country==='FR').location,'fr'));
 assert.throws(()=>swissLanguagePath('particuliers',base.find(x=>x.location.country==='CH').location,'en'));
});
test('the official language region is independent of the page translation',()=>{
 const geneva=candidates().find(x=>x.location.code==='6621'&&x.location.country==='CH').location;
 const zurich=candidates().find(x=>x.location.code==='261'&&x.location.country==='CH').location;
 assert.equal(localizedSwissRegion(geneva,'de'),'Französisch');assert.equal(localizedSwissRegion(geneva,'it'),'Francese');
 assert.equal(localizedSwissRegion(zurich,'it'),'Tedesco');assert.equal(localizedSwissRegion(zurich,'fr'),'Allemand');
 for(const location of candidates().filter(x=>x.location.country==='CH').map(x=>x.location))for(const locale of swissLanguages)assert(localizedSwissRegion(location,locale));
 assert.throws(()=>localizedSwissRegion({...geneva,languageArea:'unknown'},'de'));
});
