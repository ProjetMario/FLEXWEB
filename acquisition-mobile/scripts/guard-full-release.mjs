// The CMS pipeline builds a separate, larger site. Protect the mobile rollout if it is live.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parse} from 'parse5';
import {pages,locations,origin} from './assemble.mjs';

const dir=resolve(process.argv[2]||'dist');
const probe='/applications/suisse-romande/';
const response=await fetch((process.argv[3]||origin)+probe,{redirect:'manual',signal:AbortSignal.timeout(20000)});
assert.ok([200,404,410].includes(response.status),'Impossible de vérifier la publication mobile, HTTP '+response.status);
if (response.status===200) {
  const html=await response.text();
  const attr=(node,key)=>node.attrs?.find(a=>a.name===key)?.value;
  function find(node,tag) {
    return [...(node.tagName===tag?[node]:[]),...(node.childNodes||[]).flatMap(n=>find(n,tag))];
  }
  const canonical = document => find(document,'link').find(link=>attr(link,'rel')==='canonical');
  assert.equal(attr(canonical(parse(html))||{},'href'),origin+probe,'Réponse géographique ambiguë');
  const urlset=new Set();
  const visited=new Set();
  async function scan(path) {
    assert.ok(!visited.has(path),'Référence XML en boucle');
    visited.add(path);
    const xml=await readFile(join(dir,path),'utf8');
    if (/<sitemapindex[\s>]/.test(xml)) {
      for (const child of locations(xml)) {
        const url=new URL(child);
        assert.equal(url.origin,origin);
        await scan(url.pathname);
      }
    } else {
      assert.ok(/<urlset[\s>]/.test(xml),path);
      for (const url of locations(xml)) urlset.add(url);
    }
  }
  await scan('sitemap.xml');
  for (const {path} of pages) {
    assert.ok(urlset.has(origin+path),path+' absent du sitemap du build global');
    const doc=parse(await readFile(join(dir,path,'index.html'),'utf8'));
    assert.equal(attr(canonical(doc)||{},'href'),origin+path,path);
    assert.ok(!find(doc,'meta').some(n=>/^(robots|googlebot|bingbot)$/.test(attr(n,'name')) && /\bnoindex\b/i.test(attr(n,'content')||'')),path);
    assert.ok(find(doc,'a').some(a=>attr(a,'href')==='/demarrer/application/'),path+' lien devis mobile');
  }
  const quote=await readFile(join(dir, 'demarrer/application/index.html'),'utf8');
  assert.ok(/<form\b/.test(quote) && /1\s*990\s*€/.test(quote),'Le devis applicatif n’est plus rendu côté serveur');
  console.log('Catalogue et parcours mobiles présents dans le prochain build.');
}
