import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'smol-toml';
import {root, sha, site} from '../scripts/baseline.mjs';
import {digestOf, assertFunctions} from '../scripts/deploys.mjs';
import {filesOf, netJSON, rawFile} from './netlify.mjs';
import {buildLegacyRedirects} from './legacy-global.mjs';
import {join} from 'node:path';

export async function prepareLegacyRelease() {
  const design = JSON.parse(await readFile(join(root, 'redesign/release-candidate.json')));
  const live = (await netJSON('/sites/' + site)).published_deploy;
  assert.equal(live.title, 'Atelier Flex-Web — ' + design.id, 'La version publique doit correspondre au dernier aperçu design validé');
  assert.equal(live.locked, design.productionLocked);
  const [original, immutable, previous, config, mapping] = await Promise.all([
    filesOf(live.id), netJSON('/deploys/' + live.id), netJSON('/deploys/' + design.id),
    rawFile(live.id, '/netlify.toml'), buildLegacyRedirects(),
  ]);
  assertFunctions(previous, immutable);
  assert.equal(digestOf(original), design.digest);
  assert.equal(Object.keys(original).length, design.files);
  assert.equal(sha(config), original['/netlify.toml']);
  const {bytes, rules, before} = compile(config, mapping);
  assert.equal(before.redirects.length, design.redirects);
  for (const {from,to} of rules) assert.ok(!original[from + 'index.html'] && original[to + 'index.html'], from);
  const hash = sha(bytes);
  const files = {...original, '/netlify.toml': hash};
  const uploads = new Map([[hash, {path:'/netlify.toml', bytes}]]);
  const facts = {
    baseId:live.id, sourceCatalogueId:design.sourceCatalogueId, sourceDesignId:design.id,
    digest:digestOf(files), files:design.files, routes:design.routes, sitemaps:design.sitemaps,
    redirects:before.redirects.length + rules.length, headers:design.headers, functions:design.functions,
    productionLocked:live.locked, legacyRedirects:rules.length,
  };
  return {files, uploads, immutable, facts};
}

// Compare the entire compiled configuration, including the original 453 routing
// rules and header/query settings. Existing rules keep their processing order.
function compile(config, mapping) {
  const text = config.toString();
  const before = parse(text);
  const rules = Array.from(mapping.pairs, ([from,to]) => ({from,to,status:301}))
    .sort((a,b) => a.from.localeCompare(b.from, 'en'));
  const additions = rules.map(rule =>
    '[[redirects]]\nfrom = ' + JSON.stringify(rule.from) + '\nto = ' + JSON.stringify(rule.to) + '\nstatus = 301\n'
  ).join('\n');
  const bytes = Buffer.from(text + '\n' + additions);
  const updated = parse(bytes.toString());
  assert.deepEqual(updated.redirects.slice(before.redirects.length), rules);
  assert.deepEqual({...updated, redirects:updated.redirects.slice(0,before.redirects.length)}, before);
  return {bytes, rules, before};
}

export async function verifyCompiledRedirects(base, deployed) {
  const expected = compile(base, await buildLegacyRedirects());
  assert.equal(sha(deployed), sha(expected.bytes), 'Configuration des redirections différente de la génération validée');
}
