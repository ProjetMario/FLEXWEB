import assert from 'node:assert/strict';
import {test} from 'node:test';
import {countryLanguage,eligible} from './policy.mjs';
import {readingMarkup,previewFormOrigin} from './markup.mjs';
import {makeDictionary} from '../../public/language-assets/dictionary.mjs';
import country from '../redesign/contact/edge/language-country.js';

test('France et outre-mer, Suisse, Belgique, étranger et pays inconnu',()=>{
  for(const code of ['FR','CH','be','GP','MQ','GF','RE','YT','BL','MF','PM','WF','PF','NC','TF','XX','ZZ','AA','',null,undefined])assert.equal(countryLanguage(code),'fr',String(code));
  for(const code of ['CA','GB','US','DE','IT','SN','DZ'])assert.equal(countryLanguage(code),'en',code);
});
test('la réponse privée ne contient que la langue et ignore les en-têtes envoyés par le client',async()=>{
  const req=new Request('https://flex-web.fr/api/langue/',{headers:{'x-country':'FR','cf-ipcountry':'FR'}});
  const r=country(req,{geo:{country:{code:'CA'}}});
  assert.deepEqual(await r.json(),{language:'en'});assert.match(r.headers.get('Cache-Control'),/no-store/);
  assert.equal(country(new Request(req,{method:'POST'}),{}).status,405);
  assert.equal(country(new Request(req,{method:'HEAD'}),{}).body,null);
});
test('les espaces privés, erreurs et fichiers techniques conservent leur réponse',()=>{
  for(const path of ['/api/automation/intake','/sites/un-client/','/admin','/espace-projet/','/maquettes/x','/sitemap.xml','/sitemaps/test.xml','/llms.txt','/404.html','/.well-known/a','/language-assets/x.json'])assert.equal(eligible(path),false,path);
  assert.ok(eligible('/territoires/crm/chambery-73065/'));assert.ok(eligible('/demarrer/application/'));
  const html='<html lang="fr"><head><link rel="canonical" href="https://flex-web.fr/contact/"></head><body><iframe id="flexweb-contact-frame" src="https://formulaire-contact--flex-webb.netlify.app/"></iframe></body></html>';
  const live=readingMarkup('/contact/',html);
  assert.ok(live.includes('src="/language-assets/reader.mjs"'));assert.ok(live.includes('href="https://flex-web.fr/contact/"'));
  assert.ok(!live.includes(previewFormOrigin));assert.ok(readingMarkup('/contact/',html,true).includes('src="'+previewFormOrigin+'/'));
  assert.equal(readingMarkup('/contact/',live),live);assert.equal(readingMarkup('/espace-projet/',html),html);
});
test('le dictionnaire traduit les mots et préserve les données interpolées',()=>{
  const t=makeDictionary({'Appeler le {n0}':'Call {n0}','Site internet pour {p0} — {n1}':'Website for {p0} — {n1}','Page suivante':'Next page'});
  assert.equal(t('Appeler le +33 7 57 83 02 62'),'Call +33 7 57 83 02 62');
  assert.equal(t('Site internet pour Annecy — 1 990 €'),'Website for Annecy — 1 990 €');
  assert.equal(t('Site internet pour Annecy — 1\u202f990\u00a0€'),'Website for Annecy — 1\u202f990\u00a0€');
  assert.equal(t('  Page suivante  '),'  Next page  ');assert.equal(t('Mon brouillon personnel'),'Mon brouillon personnel');
});
