import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'parse5';
import {allPages, languages} from '../../src/data/applications/content.mjs';
import {readSitemap} from '../seo/read-sitemap.mjs';
const origin='https://flex-web.fr', root=path.resolve('dist'), base=process.env.APP_TEST_BASE;
const attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
const nodes=n=>[n,...(n.childNodes||[]).flatMap(nodes)];
const plain=n=>n?.nodeName==='#text'?n.value:['script','style'].includes(n?.tagName)?'':(n?.childNodes||[]).map(plain).join(' ');
const normal=s=>s.replace(/\s+/g,' ').trim();
const htmlPath=route=>path.join(root,route,'index.html');
const titles=new Set(),descriptions=new Set();
assert.equal(allPages.length,34);assert.equal(new Set(allPages.map(p=>p.path)).size,34);
for(const page of allPages){
 let html;
 if(base){const response=await fetch(base+page.path);assert.equal(response.status,200,page.path);html=await response.text();}
 else html=await readFile(htmlPath(page.path),'utf8');
 const all=nodes(parse(html)),main=all.find(n=>n.tagName==='main');
 assert.equal(attr(all.find(n=>n.tagName==='html'),'lang'),page.lang,page.path);
 assert.equal(all.filter(n=>n.tagName==='h1').length,1,page.path);
 assert(all.filter(n=>n.tagName==='h2').length>=5,page.path);
 const title=normal(plain(all.find(n=>n.tagName==='title'))), description=attr(all.find(n=>n.tagName==='meta'&&attr(n,'name')==='description'),'content');
 assert(title&&!titles.has(title),page.path+' duplicate title');titles.add(title);
 assert(description&&!descriptions.has(description),page.path+' duplicate description');descriptions.add(description);
 assert.equal(attr(all.find(n=>n.tagName==='link'&&attr(n,'rel')==='canonical'),'href'),origin+page.path,page.path);
 assert(!/noindex/i.test(attr(all.find(n=>n.tagName==='meta'&&attr(n,'name')==='robots'),'content')||''),page.path);
 const alternates=Object.fromEntries(all.filter(n=>n.tagName==='link'&&attr(n,'hreflang')).map(n=>[attr(n,'hreflang'),attr(n,'href')]));
 for(const lang of languages)assert.equal(alternates[lang],origin+page.topic.paths[lang],page.path+' '+lang);
 assert.equal(alternates['x-default'],origin+page.topic.paths.fr);
 const text=normal(plain(main));
 for(const needle of [page.copy.q1,page.copy.a1,page.copy.q2,page.copy.a2])assert(text.includes(normal(needle)),page.path+' visible FAQ');
 const schemas=all.filter(n=>n.tagName==='script'&&attr(n,'type')==='application/ld+json').flatMap(n=>{const s=JSON.parse((n.childNodes||[]).map(c=>c.value||'').join(''));return s['@graph']||[s];});
 for(const type of ['ProfessionalService','WebSite','WebPage','BreadcrumbList','FAQPage',page.topic.kind==='article'?'Article':'Service'])assert(schemas.some(s=>s['@type']===type),page.path+' '+type);
 const links=all.filter(n=>n.tagName==='a').map(n=>attr(n,'href')||'');
 assert(links.some(x=>x.startsWith('mailto:contact@flex-web.fr')),page.path+' email');
 assert(links.includes('tel:+33757830262'),page.path+' phone');
 if(!base)for(const href of links.filter(x=>x.startsWith('/')&&!x.startsWith('//'))){const u=new URL(href,origin);await access(htmlPath(u.pathname)).catch(()=>assert.fail(page.path+' broken '+href));}
}
if(!base){const urls=await readSitemap(origin+'/sitemap.xml',u=>readFile(path.join(root,new URL(u).pathname),'utf8'));assert.equal(new Set(urls).size,urls.length);for(const page of allPages)assert(urls.includes(origin+page.path),page.path+' missing from sitemap');}
console.log(JSON.stringify({status:'passed',pages:allPages.length,uniqueTitles:titles.size,uniqueDescriptions:descriptions.size,mode:base?'http':'built-html-and-sitemap'}));
