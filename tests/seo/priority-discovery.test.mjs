import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'parse5';
import { priorityRoutes, pageFingerprint, ORIGIN } from '../../scripts/seo/indexnow-submit.mjs';

const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };
const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));

test('every priority route is a real canonical static page listed in the sitemap', async () => {
  const names = (await readdir('dist/sitemaps')).filter(name => name.endsWith('.xml'));
  const xml = (await Promise.all(names.map(name => readFile(`dist/sitemaps/${name}`, 'utf8')))).join('\n');
  for (const route of priorityRoutes) {
    const html = await readFile(`dist${route}index.html`, 'utf8');
    assert.doesNotThrow(() => pageFingerprint(html, ORIGIN + route), route);
    assert(xml.includes(`<loc>${ORIGIN + route}</loc>`), `missing sitemap entry: ${route}`);
  }
});

test('the journal exposes project guides without JavaScript and its ItemList matches visible links', async () => {
  const doc = parse(await readFile('dist/journal/index.html', 'utf8'));
  const hrefs = new Set(), schemas = [];
  walk(doc, node => {
    const attr = attrs(node);
    if (node.tagName === 'a') hrefs.add(attr.href);
    if (node.tagName === 'script' && attr.type === 'application/ld+json') schemas.push(JSON.parse(node.childNodes.map(child => child.value || '').join('')));
  });
  const graphs = schemas.flatMap(schema => schema['@graph'] || [schema]);
  const list = graphs.find(schema => schema['@type'] === 'ItemList');
  assert(list, 'journal ItemList');
  for (const item of list.itemListElement) assert(hrefs.has(new URL(item.url).pathname), item.url);
  assert.equal([...hrefs].filter(href => href?.startsWith('/entrepreneurs/guides/')).length, 10);
  for (const route of ['/guides/preparer-projet-site-internet/', '/guides/preparer-projet-application-mobile/', '/creation-site-internet-pas-cher/', '/crm-automatisation-entreprise/']) assert(hrefs.has(route), route);
});
