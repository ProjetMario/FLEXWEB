import test from 'node:test';
import assert from 'node:assert/strict';
import {assetReferences,inspectHTML} from './inspect.mjs';

const route='/applications/ios/';
const valid='<!doctype html><html lang="fr"><head><title>Applications iOS</title><meta name="description" content="Devis mobile"><link rel="canonical" href="https://flex-web.fr/applications/ios/"><script type="application/ld+json">{"@type":"Service"}</script></head><body><h1>Créer une application</h1><a href="/contact/">Demander un devis</a><img src="/images/demo.webp"></body></html>';
test('Un seul H1, canonique propre et ressources du document',()=>{
  const result=inspectHTML(Buffer.from(valid),route);
  assert.deepEqual(result.assets,['/images/demo.webp']);
  assert.deepEqual(result.links,['/contact/']);
  assert.equal(result.structuredDataBlocks,1);
  for(const invalid of [
    valid.replace('ios/"><script','android/"><script'),
    valid.replace('</h1>','</h1><h1>Autre</h1>'),
    valid.replace('</head>','<meta name="googlebot" content="max-snippet:-1, noindex"></head>'),
    valid.replace('{"@type":"Service"}','bad json')
  ]) assert.throws(()=>inspectHTML(Buffer.from(invalid),route));
});
test('Le graphe de ressources retient les feuilles de style, modules et données statiques de navigation',()=>{
  assert.deepEqual(assetReferences(Buffer.from('body{background:url("../img/picture.webp")}'),'/styles/site.css'),['/img/picture.webp']);
  assert.deepEqual(assetReferences(Buffer.from('import x from "./shared.js";fetch("/territoires/donnees/catalogue.json");fetch("/private/file.json");'),'/assets/app.js'),['/territoires/donnees/catalogue.json','/assets/shared.js']);
});
