import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {parse} from 'parse5';
import {tsImport} from 'tsx/esm/api';
import {expandLanguageName} from './language-link.mjs';
import {filesOf, parallel, rawFile} from '../../catalogue/netlify.mjs';
import {digestOf} from '../../scripts/deploys.mjs';
import {mobilePages} from '../../src/data/mobile.mjs';
import {projectFeature} from './feature.mjs';
import {composeOffer, offerRoutes} from '../offers/compose.mjs';
import {buildOffers} from '../offers/build.mjs';

const release = fileURLToPath(new URL('../../.release/',import.meta.url));
const output = join(release,'redesign/shared');
const base = JSON.parse(await readFile(new URL('../../catalogue/release-candidate.json',import.meta.url)));
let manifest;
try {
  const cached = JSON.parse(await readFile(join(release,'catalogue/expected-manifest.json')));
  if(digestOf(cached)===base.digest) manifest=cached;
} catch(error) {
  if(error.code!=='ENOENT') throw error;
}
manifest ??= await filesOf(base.id);
assert.equal(digestOf(manifest),base.digest,'Reference catalogue digest mismatch');
const sha1 = bytes => createHash('sha1').update(bytes).digest('hex');
const style = await readFile(new URL('./studio.css',import.meta.url));
const newStyle = '/studio-redesign/interior-'+sha1(style).slice(0,12)+'.css';
const cases = ['/realisations/footnation/','/en/case-studies/footnation/'];
const mobile = new Map(mobilePages.map(page=>[page.path,page]));
const inline = new Set([...mobile.keys(),...cases]);
const visualRoutes = new Set([...inline,'/creation-site-internet/','/en/websites/','/pricing/']);
const {languagePairs} = await tsImport('../../../src/data/geo/site.ts', import.meta.url);
const languageRoutes = new Set(languagePairs.flatMap(Object.values).filter(route => route !== '/' && route !== '/en/'));
const routes = [...new Set([...visualRoutes, ...languageRoutes, ...offerRoutes.keys()])];
const styles = Object.keys(manifest).filter(path=>/^\/_astro\/global\.[^/]+\.css$/i.test(path)).sort();
assert.equal(styles.length,3,'Catalogue must be checked again if the historical stylesheet set changes');
assert.equal(inline.size,18);
const htmlPath = route => route+'index.html';
const report = { base: base.id, changedHTML:[], expandedLanguageNames:[], changedStylesheets:styles, standaloneStylesheet:newStyle,
  inlineRoutes: [...inline].sort(), featureRoutes: ['/creation-application-mobile/','/applications/ios/','/en/applications/','/en/applications/ios/','/creation-site-internet/','/en/websites/'], standaloneClientDemos:['/demo/make-peinture/','/demo/haute-savoie-decor/','/demo/jmv-renovation/'] };
async function write(path, bytes) {
  const out = join(output,path);
  await mkdir(dirname(out),{recursive:true}); await writeFile(out,bytes);
}
async function original(path) {
  const bytes = await rawFile(base.id,path);
  assert.equal(sha1(bytes),manifest[path],'Source bytes differ from catalogue manifest at '+path);
  return bytes;
}
function locate(doc, predicate) {
  if (predicate(doc)) return doc;
  for(const child of doc.childNodes??[]) {
    const match=locate(child,predicate);
    if(match) return match;
  }
}
function byClass(name) {
  return n=>n.attrs?.find(a=>a.name==='class')?.value.split(/\s+/).includes(name);
}
function range(node) {
  assert.ok(node?.sourceCodeLocation?.endTag,'Expected a complete, authored HTML element');
  return node.sourceCodeLocation;
}
function transform(source, route) {
  const doc = parse(source,{sourceCodeLocationInfo:true});
  const edits = [];
  const insert = (offset,text) => edits.push({start:offset,end:offset,text});
  const after = node => range(node).endOffset;
  if(inline.has(route)) {
    const head = locate(doc,n=>n.tagName==='head');
    insert(range(head).endTag.startOffset,'<link rel="stylesheet" href="'+newStyle+'">');
    const page = mobile.get(route);
    if(page && ['ios','hub'].includes(page.id)) {
      const offer=locate(doc,byClass('offer'));
      insert(range(offer).startOffset,projectFeature('app',page.lang));
    }
    if(cases.includes(route)) {
      const gallery=range(locate(doc,byClass('gallery')));
      const article=locate(doc,n=>n.tagName==='article'&&byClass('case')(n));
      const header=article.childNodes.find(x=>x.tagName==='header');
      edits.push({start:gallery.startOffset,end:gallery.endOffset,text:''});
      insert(after(header),source.slice(gallery.startOffset,gallery.endOffset));
    }
  } else if(route==='/pricing/') {
    const header=locate(doc,n=>n.tagName==='header'&&n.attrs?.some(x=>x.name==='class'&&x.value.includes('text-center')));
    const wrapper=header?.parentNode;
    assert.equal(wrapper?.tagName,'div');
    const classes=range(wrapper).attrs.class;
    const previous=source.slice(classes.startOffset,classes.endOffset);
    assert.ok(previous.endsWith('"'));
    edits.push({start:classes.startOffset,end:classes.endOffset,text:previous.slice(0,-1)+' studio-rates"'});
  } else {
    const h1=locate(doc,n=>n.tagName==='h1');
    let header=h1;
    while(header&&!['header','section'].includes(header.tagName)) header=header.parentNode;
    const english=route.startsWith('/en/');
    const offset=english?after(header):range(locate(header,n=>n.tagName==='aside')).startOffset;
    insert(offset,projectFeature('website',english?'en':'fr'));
  }
  let result=source;
  for(const edit of edits.sort((a,b)=>b.start-a.start)) result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
  assert.notEqual(result,source,route+' received no changes');
  return result;
}
await buildOffers();
// Only generated files within this task's ignored output directory are replaced.
await rm(output,{recursive:true,force:true});
await write(newStyle,style);
await parallel(styles,3,async path=>write(path,Buffer.concat([await original(path),Buffer.from('\n'),style])));
await parallel(routes, 4, async route => {
  const path = htmlPath(route);
  const source = (await original(path)).toString('utf8');
  const visual = visualRoutes.has(route) ? transform(source, route) : source;
  const localized = languageRoutes.has(route) ? expandLanguageName(visual) : visual;
  if (localized !== visual) report.expandedLanguageNames.push(route);
  const complete = offerRoutes.has(route) ? await composeOffer(localized, route) : localized;
  if (complete !== source) {
    await write(path, complete);
    report.changedHTML.push(path);
  }
});
report.changedHTML.sort();
report.expandedLanguageNames.sort();
await writeFile(join(release,'redesign/shared-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('Shared design prepared for '+report.changedHTML.length+' targeted HTML pages and '+styles.length+' existing global stylesheets.');
