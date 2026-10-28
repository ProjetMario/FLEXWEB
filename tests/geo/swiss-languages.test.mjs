import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates,swissTranslations,swissLanguages,swissLanguagePath,locationLanguage} from '../../src/lib/seo-expansion/fr-ch.mjs';
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
