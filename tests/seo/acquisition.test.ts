import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicLanding, classifySource, captureAcquisition, leadSource } from '../../src/lib/acquisition.ts';
import { draftEntries, draftPath, draftGroups, draftHubPath } from '../../src/lib/seo/territorial-drafts.mjs';
import { territoryDepartments } from '../../src/lib/seo/territorial-directory.mjs';
test('allow only public routes without personal paths or queries',()=>{
 for(const path of ['/','/realisations/2savoie-immo/','/ressources/','/ressources/sites/site-internet-industrie/','/ressources/automatisation/page/2/','/creation-site-internet-savoie/']) assert.equal(publicLanding(path),path);
 for(const path of ['/ressources/sites/x/?email=private','/ressources/sites/x/#private','/ressources/crm/client/','/crm/','/espace-projet/','/journal/a/?email=secret','/journal/a/#token=secret','/demarrer/']) assert.equal(publicLanding(path),null);
});
test('referrer classification never retains addresses or confuses lookalike domains',()=>{
 assert.equal(classifySource('https://www.google.fr/search?q=private','https://flex-web.fr',''),'Google naturel');
 assert.equal(classifySource('https://google.fr.attacker.test/','https://flex-web.fr',''),'Lien externe');
 assert.equal(classifySource('https://chatgpt.com/c/private','https://flex-web.fr',''),'Assistant IA');
 assert.equal(classifySource('','https://flex-web.fr','?utm_medium=email&utm_source=personal@email.test'),'Campagne');
});
test('territorial attribution accepts every generated public route, including Corsican and overseas identities',()=>{
 assert.equal(publicLanding('/territoires/'),'/territoires/');
 const entries=draftEntries();assert.equal(entries.length,19988);
 for(const {axis,commune} of entries){const path=draftPath(axis,commune);assert.equal(publicLanding(path),path);}
 for(const {axis,page} of draftGroups()){const path=draftHubPath(axis,page);assert.equal(publicLanding(path),path);}
 for(const group of territoryDepartments()){const path=`/territoires/departements/${group.code.toLowerCase()}/`;assert.equal(publicLanding(path),path);}
});
test('territorial attribution excludes search inputs, data endpoints, private routes and malformed paths',()=>{
 for(const path of [
  '/territoires/?q=adresse-privee','/territoires/#token=secret',
  '/territoires/donnees/communes.json','/territoires/donnees/communes.json/',
  '/territoires/sites/annecy-74010/?email=private','/territoires/sites/annecy-74010/#token=secret',
  '/territoires/sites/annecy-74010/\n','/territoires/sites/annecy%2F74010/',
  '/territoires/crm/client-74010/','/territoires/sites/contact-client/',
  '/territoires/sites/page/0/','/territoires/sites/page/1/','/territoires/sites/page/02/',
  '/territoires/sites/annecy-7401/','/territoires/sites/annecy-74010/details/',
  '/territoires/departements/00/','/territoires/departements/20/','/territoires/departements/999/',
  '/territoires/departements/74/?q=private','/preparation/sites/annecy-74010/',
 ]) assert.equal(publicLanding(path),null,path);
});
test('consent, first landing retention, revocation and malformed storage',()=>{
 const local = new Map(), session = new Map();
 const storage=(m:Map<string,string>)=>({getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});
 Object.assign(globalThis,{localStorage:storage(local),sessionStorage:storage(session),location:{pathname:'/creation-site-internet-savoie/',origin:'https://flex-web.fr',search:'?private=secret'},document:{referrer:'https://google.fr/search?q=secret'}});
 captureAcquisition();assert.equal(session.size,0);assert.equal(leadSource(),'site');
 local.set('flex-web-cookie-consent','accepted');captureAcquisition();assert.equal(leadSource(),'Google naturel | /creation-site-internet-savoie/');
 Object.assign(location,{pathname:'/pricing/'});captureAcquisition();assert.equal(leadSource(),'Google naturel | /creation-site-internet-savoie/');
 local.set('flex-web-cookie-consent','rejected');captureAcquisition();assert.equal(session.size,0);assert.equal(leadSource(),'site');
 local.set('flex-web-cookie-consent','accepted');session.set('flexweb-acquisition-v1','{"channel":"Google naturel","landing":"/crm/private/"}');assert.equal(leadSource(),'site');
 session.set('flexweb-acquisition-v1','broken');assert.equal(leadSource(),'site');
});
test('consented territorial attribution keeps the public pathname without the catalogue search or referrer query',()=>{
 const local=new Map<string,string>([['flex-web-cookie-consent','accepted']]),session=new Map<string,string>();
 const storage=(m:Map<string,string>)=>({getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});
 Object.assign(globalThis,{localStorage:storage(local),sessionStorage:storage(session),location:{pathname:'/territoires/',origin:'https://flex-web.fr',search:'?q=adresse-personnelle&department=74'},document:{referrer:'https://www.google.fr/search?q=nom-prive'}});
 captureAcquisition();
 assert.equal(leadSource(),'Google naturel | /territoires/');
 assert.deepEqual(JSON.parse(session.get('flexweb-acquisition-v1')!),{channel:'Google naturel',landing:'/territoires/'});
 session.clear();Object.assign(location,{pathname:'/territoires/donnees/communes.json'});captureAcquisition();
 assert.equal(session.size,0);assert.equal(leadSource(),'site');
});
