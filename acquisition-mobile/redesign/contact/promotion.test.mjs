import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {assertContactInventory, assertProcessedForm, sendRequiredBundles} from './promotion.mjs';
import {digestOf} from '../../scripts/deploys.mjs';

const source = {'/index.html':'home','/robots.txt':'robots','/sitemap.xml':'index','/sitemaps/france.xml':'urls',
  '/netlify.toml':'rules','/en/locations/a/index.html':'old','/projets-sites/a/index.html':'old','/territoires/a/index.html':'old'};
const legacy = {digest:digestOf(source),files:Object.keys(source).length};
const edge = createHash('sha256').update('edge').digest('hex');
const receipt = {edgeFunctions:{eszip2:edge}, automationDigest:'a'.repeat(64)};
const files = {...source, '/index.html':'contact', '/contact-assets/contact-form.css':'css',
  '/contact-assets/contact-form.mjs':'js','/.netlify/internal/edge-functions/manifest.json':'manifest',
  ['/.netlify/internal/edge-functions/'+edge+'.eszip']:'edge'};

test('contact preserves the certified file inventory, crawler rules and sitemap bytes', () => {
  assertContactInventory(source, files, receipt, legacy);
  for (const path of ['/robots.txt','/sitemap.xml','/sitemaps/france.xml','/netlify.toml','/en/locations/a/index.html','/projets-sites/a/index.html','/territoires/a/index.html']) {
    assert.throws(() => assertContactInventory(source, {...files,[path]:'different'}, receipt, legacy));
  }
  const missing = {...files};
  delete missing['/index.html'];
  assert.throws(() => assertContactInventory(source, missing, receipt, legacy));
  assert.throws(() => assertContactInventory(source, {...files, '/extra.html':'x'}, receipt, legacy));
  assert.throws(() => assertContactInventory(source, files, {...receipt,edgeFunctions:{eszip2:'x'}}, legacy));
});

test('only the approved edge digest may be requested, once per deploy', async () => {
  const uploaded = [], bytes = Buffer.from('edge'), sent = new Set();
  const options = {candidate:{required_edge_functions:[edge,edge]},receipt,edgeBytes:bytes,sent,
    upload:async (path, body) => uploaded.push([path,body])};
  await sendRequiredBundles(options);
  await sendRequiredBundles(options);
  assert.deepEqual(uploaded, [['/edge_functions/'+edge,bytes]]);
  await assert.rejects(sendRequiredBundles({...options,sent:new Set(),edgeBytes:Buffer.from('different')}));
  await assert.rejects(sendRequiredBundles({...options,candidate:{required_edge_functions:['other']}}));
  await assert.rejects(sendRequiredBundles({...options,candidate:{required_functions:['other']}}));
});

test('only Netlify Forms registration attributes and tag serialization may change', () => {
  const tag = '<form name="flexweb-contact" method="post" data-netlify="true" data-netlify-honeypot="bot-field">';
  const raw = Buffer.from('<h1>Contact</h1>' + tag + '<input type="hidden" name="form-name" value="flexweb-contact"></form>');
  const body = raw.toString().replace(tag, "<form method='post' name='flexweb-contact'>");
  assertProcessedForm(raw, Buffer.from(body));
  for (const changed of [body.replace('Contact</h1>', 'other</h1>'), body.replace("method='post'", "method='get'"),
    body.replace('type="hidden"', 'type="text"'), raw.toString()]) {
    assert.throws(() => assertProcessedForm(raw, Buffer.from(changed)));
  }
});
