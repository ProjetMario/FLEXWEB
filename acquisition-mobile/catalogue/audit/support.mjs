import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {createHash} from 'node:crypto';
import {parallel} from '../netlify.mjs';
import {readHTTP} from './inspect.mjs';

export async function checkSupport(host,files,indexed) {
  const groups=new Map();
  for(const file of Object.keys(files).sort()){
    if(!file.startsWith('/projets-sites/')||!file.endsWith('/index.html'))continue;
    const path=file.slice(0,-'index.html'.length);
    if(indexed.has(path))continue;
    const segments=path.split('/').filter(Boolean).slice(1);
    const category=(segments[0]==='suisse'?segments.slice(0,3):segments.slice(0,2)).join('/')||'hub';
    if(!groups.has(category))groups.set(category,{category,paths:[]});
    groups.get(category).paths.push(path);
  }
  const count=[...groups.values()].reduce((total,g)=>total+g.paths.length,0);
  assert.equal(count,8592);assert.equal(groups.size,9);
  const samples=[];
  await parallel([...groups.values()],4,async ({category,paths})=>{
    const path=paths[Math.floor(paths.length/2)];
    const {bytes,type}=await readHTTP(host,path);
    assert.match(type,/text\/html/i);
    assert.equal(createHash('sha1').update(bytes).digest('hex'),files[path+'index.html']);
    function hasNoindex(node){
      const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
      if(node.tagName==='meta' && attrs.name==='robots' && /\bnoindex\b/i.test(attrs.content||''))return true;
      return (node.childNodes||[]).some(hasNoindex);
    }
    assert.ok(hasNoindex(parse(bytes.toString())),path+' doit rester en noindex');
    samples.push({category,paths:paths.length,sampled:path});
  });
  const data=await readHTTP(host,'/territoires/donnees/catalogue.json');
  assert.match(data.type,/json/i);
  assert.ok(/\bnoindex\b/i.test(data.robots),'En-tête robots du catalogue de recherche');
  const json=JSON.parse(data.bytes);
  assert.equal(json.version,1);assert.ok(Array.isArray(json.records)&&json.records.length>0);
  return {preservedOutsideSitemap:count,noindexHTMLByCategory:samples.sort((a,b)=>a.category.localeCompare(b.category)),publicDirectoryRecords:json.records.length};
}
