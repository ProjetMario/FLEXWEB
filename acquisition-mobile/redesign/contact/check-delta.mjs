import assert from 'node:assert/strict';
import {parallel} from '../../catalogue/netlify.mjs';
import {checkCatalog} from '../../catalogue/check.mjs';
import {publishedAddresses} from '../../../scripts/contact/public-contact.mjs';
import {receiver} from './embedded.mjs';

async function readPublic(host,path,status=200) {
  const response=await fetch(new URL(path,host),{signal:AbortSignal.timeout(45000),redirect:'follow'});
  assert.equal(response.status,status,path);
  assert.equal(new URL(response.url).hostname,new URL(host).hostname,path);
  return response.text();
}
export async function checkPages(host,files,receipt) {
  const routes=new Set(['/','/contact/','/en/contact/','/en/about/','/privacy/','/mentions-legales/','/cgv/','/creation-application-mobile/','/demo/make-peinture/','/demarrer/']);
  const groups=new Map();
  for(const path of Object.keys(files).sort()) {
    const family=path.match(/^\/(?:territoires|projets-sites|en\/locations)\/[^/]+/)?.[0];
    if(path.endsWith('/index.html')&&family){
      const sample=groups.get(family)||[];sample.push(path.replace(/index\.html$/,''));groups.set(family,sample);
    }
  }
  for(const paths of groups.values())for(const i of [0,Math.floor(paths.length/2),paths.length-1])routes.add(paths[i]);
  for(const path of Object.keys(receipt.changes).filter(p=>/\.(?:txt|m?js)$/.test(p)))routes.add(path);
  await parallel([...routes],6,async path=>{
    const html=await readPublic(host,path);
    assert.deepEqual(publishedAddresses(html),[],path);
    if(path.endsWith('/'))assert.doesNotMatch(html,/<a\b[^>]*\bhref\s*=\s*["']mailto:/i,path);
    if(/^\/(?:en\/)?contact\/$/.test(path)){
      const src=receiver+(path.startsWith('/en/')?'/en/':'/');
      assert.ok(html.includes('src="'+src+'"')&&html.includes('href="'+src+'"')&&html.includes('href="tel:'),path);
    }
  });
  const missing=await readPublic(host,'/contact-introuvable-verification-flexweb/',404);
  assert.deepEqual(publishedAddresses(missing),[]);
  for(const path of ['/','/en/']){
    const form=await readPublic(receiver,path);
    assert.ok(form.includes('name="form-name" value="flexweb-contact"')&&form.includes('name="message"')&&form.includes('type="email"'),path);
    assert.deepEqual(publishedAddresses(form),[]);
  }
  console.log(routes.size+' réponses HTTP sans adresse e-mail, plus la 404 et les deux formulaires.');
}

export async function checkSitemap(host) {
  console.log(await checkCatalog(path=>readPublic(host,path),true));
}
