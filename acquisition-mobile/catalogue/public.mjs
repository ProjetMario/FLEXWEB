// Post-publication: inspect HTTP headers on the custom domain, where Netlify's preview noindex must be absent.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'parse5';
import {cacheDir,parallel} from './netlify.mjs';
import {pages} from '../scripts/assemble.mjs';

const origin='https://flex-web.fr';
const rows=(await readFile(join(cacheDir,'inventory.ndjson'),'utf8')).trimEnd().split('\n').map(JSON.parse);
const firstPerShard=new Map();
for(const r of rows) if(!firstPerShard.has(r.sitemap)) firstPerShard.set(r.sitemap,r.path);
assert.equal(firstPerShard.size,85);
const routes=new Set([...firstPerShard.values(),...rows.filter(r=>r.path.startsWith('/entrepreneurs/')).map(r=>r.path),...pages.map(p=>p.path),'/','/en/']);
await parallel([...routes],5,async path=>{
  const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(40000)});
  assert.equal(response.status,200,path);
  assert.doesNotMatch(response.headers.get('x-robots-tag')||'',/\b(?:none|noindex)\b/i,path);
  const doc=parse(await response.text());
  const head=doc.childNodes.find(n=>n.tagName==='html')?.childNodes.find(n=>n.tagName==='head');
  const canonicals=[];
  for (const node of head?.childNodes||[]) {
    const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
    if(node.tagName==='link'&&attrs.rel==='canonical') canonicals.push(attrs.href);
    if(node.tagName==='meta'&&['robots','googlebot','bingbot'].includes(attrs.name?.toLowerCase())) assert.doesNotMatch(attrs.content,/\b(?:noindex|none)\b/i,path);
  }
  assert.deepEqual(canonicals,[origin+path],path);
});
const robots=await fetch(origin+'/robots.txt',{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(robots.status,200);
assert.match(await robots.text(),/^Sitemap:\s*https:\/\/flex-web\.fr\/sitemap\.xml\s*$/mi);
console.log(routes.size+' pages publiques revérifiées par HTTP sur flex-web.fr, avec canonique et directives d’indexation.');
