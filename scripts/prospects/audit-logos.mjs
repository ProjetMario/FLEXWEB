import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';

const localAsset = /^\/images\/prospects\/logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|png|jpe?g|webp|gif)$/;
const allowedFields = new Set(['src','alt','width','height','origin','sourceUrl','verifiedAt','iconSrc','background']);
export function validateLogo(logo, slug) {
  assert(logo && Object.keys(logo).every(key=>allowedFields.has(key)), `Missing or unexpected logo metadata: ${slug}`);
  assert(localAsset.test(logo.src), `Logo must be a local bounded asset: ${slug}`);
  assert(typeof logo.alt==='string' && logo.alt.trim(), `Missing logo description: ${slug}`);
  assert(Number.isInteger(logo.width) && logo.width>0 && Number.isInteger(logo.height) && logo.height>0, `Invalid logo dimensions: ${slug}`);
  assert(['official','proposed'].includes(logo.origin), `Invalid logo origin: ${slug}`);
  if(logo.background) assert(/^#[0-9a-f]{6}$/i.test(logo.background),`Invalid logo backdrop: ${slug}`);
  if(logo.iconSrc) assert(localAsset.test(logo.iconSrc) && logo.iconSrc.endsWith('.svg'), `Invalid icon asset: ${slug}`);
  if(logo.origin==='official') {
    const source = new URL(logo.sourceUrl);
    assert(source.protocol==='https:' && !source.username && !source.password, `Invalid official source: ${slug}`);
    assert(typeof logo.verifiedAt==='string' && Number.isFinite(Date.parse(logo.verifiedAt)), `Official logo requires actual verification date: ${slug}`);
  } else {
    assert(!logo.sourceUrl && !logo.verifiedAt, `Proposed logo must not imply official verification: ${slug}`);
  }
}
export function validateLogoBytes(bytes, asset) {
  assert(bytes.length>50 && bytes.length<3000000, `Logo is empty or oversized: ${asset}`);
  if(asset.endsWith('.svg')) {
    const xml=bytes.toString('utf8');
    assert(/<svg\b/.test(xml) && /viewBox=/.test(xml), `Invalid SVG: ${asset}`);
    assert(!/<(?:script|foreignObject|image|iframe|animate|set)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|<!ENTITY|<!DOCTYPE/i.test(xml), `Active or remote SVG content: ${asset}`);
  } else if(/\.png$/.test(asset)) assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Invalid PNG: ${asset}`);
  else if(/\.jpe?g$/.test(asset)) assert(bytes[0]===255 && bytes[1]===216 && bytes[2]===255,`Invalid JPEG: ${asset}`);
  else if(/\.gif$/.test(asset)) assert(/^GIF8[79]a$/.test(bytes.toString('ascii',0,6)),`Invalid GIF: ${asset}`);
  else if(/\.webp$/.test(asset)) assert(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP',`Invalid WebP: ${asset}`);
}
const allNodes=node=>[node,...(node.childNodes??[]).flatMap(allNodes)];
const attrs=node=>Object.fromEntries((node.attrs??[]).map(a=>[a.name,a.value]));
export async function auditLogos({root=process.cwd(),dist=path.join(root,'dist')}={}) {
  const prospects=JSON.parse(await readFile(path.join(root,'src/data/prospects.json'),'utf8'));
  const logos=JSON.parse(await readFile(path.join(root,'src/data/prospect-logos.json'),'utf8'));
  assert.deepEqual(Object.keys(logos).sort(),prospects.map(p=>p.slug).sort(),'Logo coverage must match the complete prospect registry');
  let official=0; let proposed=0;
  for(const p of prospects) {
    const logo=logos[p.slug];validateLogo(logo,p.slug);
    for(const asset of [logo.src,logo.iconSrc].filter(Boolean)) validateLogoBytes(await readFile(path.join(dist,asset)),asset);
    const html=await readFile(path.join(dist,p.slug,'index.html'),'utf8');
    const nodes=allNodes(parse(html));
    assert(nodes.some(n=>n.tagName==='img' && attrs(n).src===logo.src && attrs(n).alt===logo.alt),`Logo is not rendered: ${p.slug}`);
    assert(nodes.some(n=>attrs(n)['data-logo-origin']===logo.origin),`Logo provenance marker missing: ${p.slug}`);
    if(logo.origin==='proposed') {proposed++; assert(html.includes('Logo proposé') && html.includes('Proposition de logo créée par Flex-Web'),`Proposed identity is not disclosed: ${p.slug}`);}
    else {official++; assert(nodes.some(n=>n.tagName==='a' && attrs(n).href===logo.sourceUrl),`Official logo provenance is not linked: ${p.slug}`);}
  }
  return {status:'passed',logos:prospects.length,official,proposed};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) auditLogos().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
