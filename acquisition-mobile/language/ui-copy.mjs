// Include labels that appear only after consent, hydration, an error or a change of offer.
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const files=['components/onboarding/StartProject.jsx','components/onboarding/QuoteCookieConsent.jsx','data/pricing.ts'];
const copy=new Set();
function visit(node) {
  if(ts.isJsxText(node) || ts.isStringLiteral(node)) {
    const value=node.text.trim().replace(/\s+/gu,' ');
    if(value && (ts.isJsxText(node) || /[À-ÿ’…€]|\s[a-z]+\s/i.test(value)) &&
      !/[\\{}=;/]|^[-a-z0-9]+ |^\./.test(value) && !value.includes('rounded-'))copy.add(value);
  }
  ts.forEachChild(node,visit);
}
for(const file of files){
  const source=await readFile(new URL('../../src/'+file,import.meta.url),'utf8');
  visit(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,false,file.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.TS));
}
// The catalogue also contains published form bundles from an earlier release.
const [mode,target]=process.argv.slice(2);
if(mode){
  if(!['--dist','--origin'].includes(mode)) throw Error('Unknown rendered source');
  const load=async path=>{
    if(mode==='--dist')return readFile(resolve(target,'.'+path),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
    const site=new URL(target);
    if(site.protocol!=='https:' || !/^(?:flex-web\.fr|[a-f0-9]{24}--flex-webb\.netlify\.app)$/.test(site.hostname))throw Error('Unknown catalogue origin');
    const r=await fetch(new URL(path,site),{redirect:'error'});if(r.status===404)return '';if(!r.ok)throw Error('Could not read '+path);return r.text();
  };
  const pending=new Set(),seen=new Set();
  for(const path of ['/demarrer/','/demarrer/application/']){
    const html=await load(path+(mode==='--dist'?'index.html':''));
    for(const match of html.matchAll(/component-url="(\/_astro\/(?:StartProject|StartApplication|(?:Quote)?CookieConsent)\.[\w.-]+\.js)"/g))pending.add(match[1]);
  }
  for(const path of pending){
    if(seen.has(path))continue;seen.add(path);
    const source=await load(path);
    visit(ts.createSourceFile(path,source,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS));
    for(const match of source.matchAll(/from\s*["']\.\/(api\.[a-zA-Z0-9_.-]+\.js)["']/g))pending.add('/_astro/'+match[1]);
  }
}
console.log(JSON.stringify([...copy]));
