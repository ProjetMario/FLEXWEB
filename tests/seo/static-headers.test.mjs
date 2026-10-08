import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseDocument} from '../../scripts/seo/audit-indexability.mjs';
import {parseStaticHeaders,staticRobotsForUrl} from '../../scripts/seo/static-headers.mjs';

const html=url=>`<head><title>Page publique</title><link rel="canonical" href="${url}"></head><main>Contenu</main>`;
test('static release gate combines global and scoped robots for Google and Bing',()=>{
 const rules=parseStaticHeaders(`/*\n  Cache-Control: public\n  X-Robots-Tag: index\n/territoires/:axis/*\n  X-Robots-Tag: googlebot: noindex\n  x-robots-tag: bingbot: noindex\n/demarrer/\n  X-Robots-Tag: noindex\n`);
 const route='https://flex-web.fr/territoires/sites/example/';
 const inspection=analyseDocument(html(route),route,staticRobotsForUrl(route,rules));
 assert.deepEqual(inspection.issues,['noindex']);
 assert.equal(inspection.googleIndexable,false);
 assert.equal(inspection.bingIndexable,false);
 const home='https://flex-web.fr/';
 assert.deepEqual(analyseDocument(html(home),home,staticRobotsForUrl(home,rules)).issues,[]);
 assert.equal(staticRobotsForUrl('https://flex-web.fr/demarrer-autre/',rules),'index');
});

test('header matching respects exact paths, wildcard paths and domain-qualified rules',()=>{
 const rules=parseStaticHeaders(`# example\nhttps://flex-web.fr/pricing/\n  X-Robots-Tag: none\n/territoires/donnees/*\n  X-Robots-Tag: noindex\n`);
 assert.equal(staticRobotsForUrl('https://flex-web.fr/pricing/?x=1',rules),'none');
 assert.equal(staticRobotsForUrl('https://preview.test/pricing/',rules),'');
 assert.equal(staticRobotsForUrl('https://flex-web.fr/territoires/donnees/catalogue.json',rules),'noindex');
 assert.equal(staticRobotsForUrl('https://flex-web.fr/territoires/sites/annecy/',rules),'');
 assert.deepEqual(parseStaticHeaders(''),[]);
});
