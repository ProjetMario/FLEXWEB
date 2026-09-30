import {createHash} from 'node:crypto';
import {parse} from 'parse5';

export const SITE='https://flex-web.fr';
export const COLLECTIONS=['pages','pages_commerciales','realisations','guides','communes','fiches_territoriales'];
export const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(canonical(value))).digest('hex');
export const baselineHash=entry=>hash({title:entry.title,seoTitle:entry.seoTitle,seoDescription:entry.seoDescription,content:entry.content,data:entry.data});
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attrs=n=>Object.fromEntries((n.attrs??[]).map(a=>[a.name,a.value]));
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes??[]).map(text).join('');
const tag=n=>n.tagName??'';
const eligible=new Set(['h1','h2','h3','h4','p','li','summary','figcaption','blockquote']);
const excluded=new Set(['script','style','noscript','form','input','button','select','textarea','code','pre','nav','footer','astro-island']);
const inline=new Set(['a','strong','b','em','i','u','s','span','small','br','time','abbr','sup','sub']);
const normalize=s=>s.replace(/\s+/g,' ').trim();
function walk(node,fn){fn(node);for(const n of node.childNodes??[])walk(n,fn);}
export function safeLink(value){
 if(typeof value!=='string'||/[\u0000-\u0020\\]/.test(value))throw Error('Lien invalide');
 if(value.startsWith('#'))return value;
 if(value.startsWith('/')&&!value.startsWith('//'))return value;
 const u=new URL(value);if(!['https:','mailto:','tel:'].includes(u.protocol)||u.username||u.password)throw Error('Protocole de lien interdit');return value;
}
function isInline(n){return n.nodeName==='#text'||(inline.has(tag(n))&&(n.childNodes??[]).every(isInline));}
function spans(node){
 const children=[],markDefs=[];let i=0;
 function visit(n,marks=[]){
  if(n.nodeName==='#text'){if(n.value)children.push({_type:'span',_key:`s${i++}`,text:n.value,marks});return;}
  const t=tag(n),a=attrs(n);let next=marks;
  if(['strong','b'].includes(t))next=[...marks,'strong'];
  if(['em','i'].includes(t))next=[...marks,'em'];
  if(t==='a'&&a.href){const k=`link${markDefs.length}`;markDefs.push({_type:'link',_key:k,href:a.href});next=[...marks,k];}
  if(t==='br')children.push({_type:'span',_key:`s${i++}`,text:'\n',marks});
  for(const child of n.childNodes??[])visit(child,next);
 }
 visit(node);return {children,markDefs};
}
export function extractPage(html,path){
 if(!/^\/(?:[a-z0-9-]+\/)*$/.test(path))throw Error(`Route publique invalide: ${path}`);
 const doc=parse(html,{sourceCodeLocationInfo:true});let main,title,description,canonical;const schemas=[];
 walk(doc,n=>{const a=attrs(n);if(tag(n)==='main'&&!main)main=n;if(tag(n)==='title')title=n;if(tag(n)==='meta'&&a.name==='description')description=n;if(tag(n)==='link'&&a.rel==='canonical')canonical=a.href;if(tag(n)==='script'&&a.type==='application/ld+json')schemas.push(n);});
 if(!main||!title||canonical!==SITE+path)throw Error(`Page sans main/title/canonical correcte: ${path}`);
 const blocks=[],locations=new Map(),counts=new Map();
 function collect(n){
  if(excluded.has(tag(n))||attrs(n)['data-cms-lock']!==undefined||attrs(n)['data-cms-generated']!==undefined)return;
  if(eligible.has(tag(n))&&(n.childNodes??[]).every(isInline)&&normalize(text(n))){
   const signature=hash([tag(n),normalize(text(n))]).slice(0,20),count=counts.get(signature)??0;counts.set(signature,count+1);
   const key=`b${signature}_${count}`,location=n.sourceCodeLocation;if(!location?.endTag)return;
   const b={_type:'block',_key:key,style:['h1','h2','h3','h4','blockquote'].includes(tag(n))?tag(n):'normal',...spans(n)};
   blocks.push(b);locations.set(key,{node:n,block:b,start:location.startTag.endOffset,end:location.endTag.startOffset});return;
  }
  for(const child of n.childNodes??[])collect(child);
 }
 collect(main);
 const result={title:normalize(text(title)),description:attrs(description??{}).content??'',content:blocks};
 return {...result,renderHash:hash(result),locations,main,titleNode:title,descriptionNode:description,schemas};
}
export function blockText(block){return (block.children??[]).map(c=>c.text??'').join('');}
export function renderBlockBody(block){
 if(block._type!=='block'||!Array.isArray(block.children)||!Array.isArray(block.markDefs??[]))throw Error('Bloc de contenu invalide');
 const defs=new Map((block.markDefs??[]).map(m=>[m._key,m]));
 return block.children.map(s=>{
  if(s._type!=='span'||typeof s.text!=='string'||s.text.length>30000)throw Error('Texte invalide');
  let value=escapeHtml(s.text).replace(/\n/g,'<br>');
  for(const m of s.marks??[]){if(m==='strong')value=`<strong>${value}</strong>`;else if(m==='em')value=`<em>${value}</em>`;else {const d=defs.get(m);if(d?._type!=='link')throw Error('Annotation non prise en charge');value=`<a href="${escapeHtml(safeLink(d.href))}">${value}</a>`;}}
  return value;
 }).join('');
}
function moneyTokens(s){return [...s.matchAll(/\d[\d\s.,]*\s*(?:€|euros?\b)/gi)].map(m=>normalize(m[0]));}
export function applyPage(html,entry){
 const page=extractPage(html,entry.path);if(entry.data?.renderHash!==page.renderHash)throw Error(`Contenu source modifié: ${entry.path}. Réimporter et comparer avant publication.`);
 const replacements=[],seen=new Set(),textMap=new Map();const incoming=entry.content??page.content;
 if(!Array.isArray(incoming)||incoming.length>2000)throw Error('Document éditorial invalide');
 if(entry.path.startsWith('/ressources/')&&entry.collection==='guides'){
  const review=entry.data?.editorialReview;
  if(!review||review.hash!==hash({content:incoming,seoTitle:entry.seoTitle,seoDescription:entry.seoDescription,additionalSections:entry.data?.additionalSections??[]})||!review.reviewer?.trim()||!Number.isFinite(Date.parse(review.reviewedAt)))throw Error('Ce guide nécessite une relecture de la révision actuelle');
 }
 for(const b of incoming){
  if(seen.has(b._key))throw Error('Bloc dupliqué');seen.add(b._key);
  const original=page.locations.get(b._key);
  if(!original)throw Error(`Bloc inconnu: ${b._key}. Utiliser les sections supplémentaires.`);
  if(hash(b)===hash(original.block))continue;
  if(b.style!==original.block.style)throw Error('La structure des titres doit être conservée');
  const oldText=blockText(original.block),newText=blockText(b);
  if(!normalize(newText))throw Error('Un bloc existant ne peut pas être vidé');
  if(JSON.stringify(moneyTokens(oldText))!==JSON.stringify(moneyTokens(newText))||(moneyTokens(oldText).length&&normalize(oldText)!==normalize(newText)))throw Error('Les tarifs restent gérés dans le catalogue partagé');
  replacements.push({start:original.start,end:original.end,value:renderBlockBody(b)});textMap.set(normalize(oldText),normalize(newText));
 }
 if(seen.size!==page.locations.size)throw Error('Les blocs existants ne peuvent pas être supprimés implicitement');
 const seoTitle=entry.seoTitle||page.title,seoDescription=entry.seoDescription||page.description;
 if(typeof seoTitle!=='string'||seoTitle.length>180||typeof seoDescription!=='string'||seoDescription.length>600)throw Error('Métadonnées invalides');
 // Keep share previews consistent with the title/description visible to search engines.
 walk(parse(html,{sourceCodeLocationInfo:true}),n=>{const a=attrs(n);const kind=a.property??a.name;if(tag(n)!=='meta')return;const v=['og:title','twitter:title'].includes(kind)?seoTitle:['og:description','twitter:description'].includes(kind)?seoDescription:null;if(v!==null&&v!==a.content){const l=n.sourceCodeLocation;replacements.push({start:l.startOffset,end:l.endOffset,value:`<meta ${a.property?'property':'name'}="${escapeHtml(kind)}" content="${escapeHtml(v)}">`});}});
 if(seoTitle!==page.title){const l=page.titleNode.sourceCodeLocation;replacements.push({start:l.startTag.endOffset,end:l.endTag.startOffset,value:escapeHtml(seoTitle)});textMap.set(page.title,seoTitle);}
 if(seoDescription!==page.description&&page.descriptionNode){const l=page.descriptionNode.sourceCodeLocation;replacements.push({start:l.startOffset,end:l.endOffset,value:`<meta name="description" content="${escapeHtml(seoDescription)}">`});textMap.set(page.description,seoDescription);}
 for(const schema of page.schemas){
  const original=JSON.parse(text(schema));let changed=false;
  const update=value=>{if(typeof value==='string'&&textMap.has(normalize(value))){changed=true;return textMap.get(normalize(value));}if(Array.isArray(value))return value.map(update);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,update(v)]));return value;};
  const updated=update(original);if(changed){const l=schema.sourceCodeLocation;replacements.push({start:l.startTag.endOffset,end:l.endTag.startOffset,value:JSON.stringify(updated).replace(/</g,'\\u003c')});}
 }
 const extras=entry.data?.additionalSections??[];
 if(!Array.isArray(extras)||extras.length>12)throw Error('Sections supplémentaires invalides');
 if(extras.length){const body=extras.map(s=>{if(typeof s.title!=='string'||typeof s.text!=='string'||!s.title.trim()||!s.text.trim()||s.title.length>200||s.text.length>15000)throw Error('Section incomplète');if(moneyTokens(s.title+' '+s.text).length)throw Error('Ajouter les tarifs depuis le catalogue partagé');return `<section><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.text)}</p></section>`;}).join('');const pos=page.main.sourceCodeLocation.endTag.startOffset;replacements.push({start:pos,end:pos,value:`<div data-cms-generated class="cms-editorial" style="max-width:960px;margin:32px auto;padding:24px">${body}</div>`});}
 let out=html;for(const r of replacements.sort((a,b)=>b.start-a.start))out=out.slice(0,r.start)+r.value+out.slice(r.end);return out;
}
export function classifyPath(path){
 if(/^\/territoires\/(sites|automatisation)\/[^/]+-[a-z0-9]{5}\/$/.test(path))return 'fiches_territoriales';
 if(/^\/realisations\/[^/]+\/$/.test(path))return 'realisations';
 if(path.startsWith('/journal/')||/^\/ressources\/(sites|automatisation)\/[^/]+\/$/.test(path))return 'guides';
 if(/^\/(creation-|automatisation-)/.test(path))return 'pages_commerciales';return 'pages';
}
export function sourceId(path){const m=path.match(/^\/territoires\/(sites|automatisation)\/[^/]+-([a-z0-9]{5})\/$/);return m?`${m[1]}:${m[2].toUpperCase()}`:path;}
