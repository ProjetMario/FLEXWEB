import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {filesOf, parallel} from '../../catalogue/netlify.mjs';
import {hasPublicMailbox} from '../../../scripts/contact/public-contact.mjs';

const [url, baseId] = process.argv.slice(2);
const host = new URL(url);
assert.ok(host.protocol === 'https:');
const files = Object.keys(await filesOf(baseId)).sort();
const familyGroups = new Map();
for (const path of files.filter(p => p.endsWith('/index.html'))) {
  const parts = path.slice(1).split('/');
  const depth = parts[0] === 'en' && parts[1] === 'locations' ? 3 : 2;
  if (!['territoires', 'projets-sites'].includes(parts[0]) && !(parts[0] === 'en' && parts[1] === 'locations')) continue;
  const family = parts.slice(0,depth).join('/');
  const members = familyGroups.get(family) || [];
  members.push(path.replace(/index\.html$/,''));
  familyGroups.set(family, members);
}
const paths = new Set(['/', '/en/', '/contact/', '/en/contact/', '/creation-application-mobile/', '/demarrer/', '/privacy/', '/mentions-legales/', '/llms.txt', '/llms-full.txt', '/ai-overview.txt', '/communes-france/', '/sitemap.xml', '/contact-assets/contact-form.css', '/contact-assets/contact-form.mjs']);
for (const members of familyGroups.values()) {
  for (const index of [0, Math.floor(members.length / 2), members.length - 1]) paths.add(members[index]);
}
for (const file of files.filter(p => p.startsWith('/_astro/') && p.endsWith('.js'))) paths.add(file);
const families = ['/territoires/', '/projets-sites/', '/en/locations/'];
for (const prefix of families) paths.add(prefix);
function collect(node, array) {
  if (node.tagName) array.push(node);
  for (const child of node.childNodes || []) collect(child, array);
}
await parallel([...paths], 6, async path => {
  const absolute = new URL(path, host);
  const res = await fetch(absolute, {signal:AbortSignal.timeout(45000)});
  // Some directory roots have an intentional redirect to the directory index.
  assert.equal(res.status,200, path + ' ' + res.status);
  assert.equal(new URL(res.url).host, host.host, path);
  const text = await res.text();
  assert.ok(!hasPublicMailbox(text), path);
  if (path === '/contact/' || path === '/en/contact/') {
    const nodes = [];
    collect(parse(text), nodes);
    const attr = (node,key) => node.attrs.find(a => a.name === key)?.value;
    assert.equal(nodes.filter(n => n.tagName === 'form' && attr(n,'name') === 'flexweb-contact').length, 1, path);
    assert.ok(nodes.some(n => n.tagName === 'a' && attr(n,'href')?.startsWith('tel:')), path);
    assert.ok(nodes.some(n => n.tagName === 'textarea' && attr(n,'name') === 'message'), path);
  }
});
console.log(paths.size + ' URL publiques vérifiées, dont les fichiers JavaScript et les pages de contact.');
