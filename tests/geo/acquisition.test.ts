import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { identifyAISource, classifySource, publicLanding, territoryLanding, captureAcquisition, leadSource, acquisitionEventFields } from '../../src/lib/acquisition';
import { trackLead } from '../../src/lib/analytics';
const origin = 'https://flex-web.fr';
const consent = 'flex-web-cookie-consent';
const key = 'flexweb-acquisition-v1';
function storage() { const values = new Map(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => values.set(k,v), removeItem: (k: string) => values.delete(k) }; }
let events: unknown[][];
beforeEach(() => {
  const localStorage = storage(), sessionStorage = storage();
  const location = { origin, pathname: '/en/crm/', search: '?utm_source=chatgpt.com&private=must-not-leak' };
  events = [];
  Object.assign(globalThis, { localStorage, sessionStorage, location, document: { referrer: '' }, window: { localStorage, location, gtag: (...args: unknown[]) => events.push(args) } });
});
test('recognises only explicit AI referrers or recognised source tags', () => {
  for (const [host,source] of [['chatgpt.com','chatgpt'],['chat.openai.com','chatgpt'],['claude.ai','claude'],['gemini.google.com','gemini'],['grok.com','grok'],['copilot.microsoft.com','copilot'],['www.perplexity.ai','perplexity']]) {
    assert.equal(identifyAISource(`https://${host}/private-conversation?secret=1`, origin, ''), source);
    assert.equal(classifySource(`https://${host}/`, origin, ''), 'Assistant IA');
  }
  assert.equal(identifyAISource('', origin, '?utm_source=ChatGPT'), 'chatgpt');
  for (const source of ['constructor','toString','__proto__','openai.com.evil.test','private-customer-text']) assert.equal(identifyAISource('',origin,`?utm_source=${source}`), 'unknown');
  for (const ref of ['https://chatgpt.com.evil.test/', 'https://example.org/chatgpt.com', 'https://x.com/', 'https://www.google.fr/search?q=x', 'https://bing.com/chat', origin+'/en/crm/', 'data:text/html,chatgpt.com']) assert.equal(identifyAISource(ref,origin,''), 'unknown');
});
test('paid or email campaigns take precedence; normal Google and Bing stay distinct', () => {
  assert.equal(classifySource('https://chatgpt.com/', origin, '?utm_source=chatgpt&gclid=x'), 'Campagne');
  assert.equal(identifyAISource('https://chatgpt.com/', origin, '?utm_medium=email'), 'unknown');
  assert.equal(classifySource('https://google.fr/search?q=x',origin,''), 'Google naturel');
  assert.equal(classifySource('https://bing.com/search?q=x',origin,''), 'Autre moteur');
});
test('never stores attribution before consent and erases it on refusal', () => {
  captureAcquisition(); assert.equal(sessionStorage.getItem(key), null); assert.equal(leadSource(), 'site');
  localStorage.setItem(consent, 'accepted'); captureAcquisition(); assert.match(leadSource(), /chatgpt/);
  localStorage.setItem(consent, 'refused'); captureAcquisition(); assert.equal(sessionStorage.getItem(key), null); assert.equal(trackLead('project_quote','automation'), false); assert.equal(events.length,0);
});
test('keeps first permitted public landing across navigation to the quote form', () => {
  localStorage.setItem(consent,'accepted'); captureAcquisition();
  Object.assign(location,{pathname:'/demarrer/',search:'?token=private'}); captureAcquisition();
  assert.equal(leadSource(), 'Assistant IA (chatgpt) | /en/crm/');
  assert.deepEqual(acquisitionEventFields(), {ai_source:'chatgpt',landing_language:'en'});
  assert.equal(trackLead('project_quote','automation'), true);
  const payload = events[0][2] as Record<string, unknown>;
  assert.equal(payload.ai_source,'chatgpt'); assert.equal(payload.landing_language,'en'); assert.equal(payload.page_location,origin+'/demarrer/');
  assert.doesNotMatch(JSON.stringify(events)+sessionStorage.getItem(key), /token|secret|private|utm_source|conversation/);
});
test('rejects private routes, forged stored categories and unknown English paths', () => {
  for (const path of ['/api/intake/','/admin/','/espace-projet/secret/','/en/private/','/en/crm/?email=x','/en/crm/#client','/crm-automatisation-entreprise/%2f/']) assert.equal(publicLanding(path),null);
  localStorage.setItem(consent,'accepted');
  sessionStorage.setItem(key,JSON.stringify({channel:'Assistant IA',landing:'/espace-projet/token/',aiSource:'chatgpt'})); assert.equal(leadSource(),'site');
  sessionStorage.setItem(key,JSON.stringify({channel:'Assistant IA',landing:'/en/crm/',aiSource:'private text'})); assert.deepEqual(acquisitionEventFields(),{ai_source:'unknown',landing_language:'en'});
  sessionStorage.setItem(key,JSON.stringify({channel:'Google naturel',landing:'/about/'})); assert.equal(leadSource(),'Google naturel | /about/');
});
test('website and application landing pages are eligible but unknown paths are not', () => {
 for (const path of ['/guides/preparer-projet-site-internet/','/guides/preparer-projet-application-mobile/','/en/websites/','/en/applications/','/en/guides/website-project-brief/','/en/guides/application-project-brief/']) assert.equal(publicLanding(path),path);
 assert.equal(publicLanding('/en/guides/private-client/'),null);
});
test('territorial attribution uses an official code and a bounded language, never slug text', () => {
  assert.equal(territoryLanding('/projets-sites/particuliers/zurich-ch-261/','particuliers:CH:261'),'territoire:CH:261:particuliers');
  assert.equal(territoryLanding('/projets-sites/particuliers/nom-prive-ch-261/','particuliers:CH:261'),'territoire:CH:261:particuliers');
  assert.equal(territoryLanding('/projets-sites/particuliers/zurich-ch-261/','entreprises:CH:261'),null);
  assert.equal(territoryLanding('/projets-sites/particuliers/zurich-ch-261/?secret=1','particuliers:CH:261'),null);
  assert.equal(territoryLanding('/espace-projet/private/','particuliers:CH:261'),null);
  localStorage.setItem(consent,'accepted');
  Object.assign(location,{pathname:'/projets-sites/particuliers/zurich-ch-261/',search:'?utm_source=chatgpt'});
  Object.assign(document,{documentElement:{lang:'de'},querySelector:()=>({getAttribute:()=> 'particuliers:CH:261'})});
  captureAcquisition();
  assert.equal(leadSource(),'Assistant IA (chatgpt) | territoire:CH:261:particuliers');
  assert.deepEqual(acquisitionEventFields(),{ai_source:'chatgpt',landing_language:'de'});
  assert.doesNotMatch(sessionStorage.getItem(key),/zurich|utm_source/);
  localStorage.setItem(consent,'refused');captureAcquisition();assert.equal(sessionStorage.getItem(key),null);
});
test('a territorial path without a matching server marker is not recorded', () => {
  localStorage.setItem(consent,'accepted');Object.assign(location,{pathname:'/projets-sites/entreprises/inconnu-fr-12345/',search:''});
  captureAcquisition();assert.equal(sessionStorage.getItem(key),null);
});
test('storage failures do not interrupt the quote flow', () => {
  globalThis.localStorage.getItem = () => { throw new Error('storage denied'); };
  captureAcquisition(); assert.equal(leadSource(),'site'); assert.doesNotThrow(()=>trackLead('project_quote','automation'));
});
