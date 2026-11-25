import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedPaths} from '../catalogue/check.mjs';
import {eligible} from './policy.mjs';
export async function verifyInventory(directory) {
  const root=resolve(directory,'language-assets/data');
  const shards=new Map();
  for(const name of await readdir(join(root,'routes'))) {
    if(!/^[0-9a-f]{2}\.json$/.test(name))continue;
    shards.set(name.slice(0,2),JSON.parse(await readFile(join(root,'routes',name))));
  }
  const dict={};
  for(const pair of ['fr-en','en-fr'])dict[pair]=new Set(await readdir(join(root,pair)));
  function lookup(path) {
    const hash=createHash('sha256').update(path).digest('hex');
    const row=shards.get(hash.slice(0,2))?.[hash.slice(2,18)];
    assert.ok(row,'Route de lecture absente '+path);return row;
  }
  let english=0,frenchReading=0,englishReading=0;
  for(const path of expectedPaths) {
    if(!eligible(path))continue;
    const [group,fr,en]=lookup(path);
    if(path.startsWith('/en/')) {
      english++;
      if(fr)assert.equal(lookup(fr)[2],path,'FR/EN '+path);
      else {englishReading++;assert.ok(dict['en-fr'].has(group+'.json'),'Dictionnaire français '+path);}
    } else if(!/^\/(?:de|it)\//.test(path)) {
      if(en) {if(!fr)assert.equal(lookup(en)[1],path,'EN/FR '+path);}
      else if(!fr){frenchReading++;assert.ok(dict['fr-en'].has(group+'.json'),'Dictionnaire anglais '+path);}
    }
  }
  return {sitemapUrls:expectedPaths.size,englishUrls:english,frenchPagesWithReadingEnglish:frenchReading,englishPagesWithReadingFrench:englishReading};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await verifyInventory(process.argv[2]||'public'));
