// Include labels that appear only after consent, hydration, an error or a change of offer.
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
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
console.log(JSON.stringify([...copy]));
