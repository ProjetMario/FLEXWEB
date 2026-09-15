import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicLanding, classifySource, captureAcquisition, leadSource } from '../../src/lib/acquisition.ts';
test('allow only public routes without personal paths or queries',()=>{
 for(const path of ['/','/realisations/2savoie-immo/','/creation-site-internet-savoie/']) assert.equal(publicLanding(path),path);
 for(const path of ['/crm/','/espace-projet/','/journal/a/?email=secret','/journal/a/#token=secret','/demarrer/']) assert.equal(publicLanding(path),null);
});
test('referrer classification never retains addresses or confuses lookalike domains',()=>{
 assert.equal(classifySource('https://www.google.fr/search?q=private','https://flex-web.fr',''),'Google naturel');
 assert.equal(classifySource('https://google.fr.attacker.test/','https://flex-web.fr',''),'Lien externe');
 assert.equal(classifySource('https://chatgpt.com/c/private','https://flex-web.fr',''),'Assistant IA');
 assert.equal(classifySource('','https://flex-web.fr','?utm_medium=email&utm_source=personal@email.test'),'Campagne');
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
