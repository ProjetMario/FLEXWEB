import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractPage, hash, baselineHash } from './content.mjs';
import { renderSnapshot } from './render.mjs';

const commune = { code: '73329', name: 'Voglans' };
const siteRoute = '/territoires/sites/voglans-73329/';
const automationRoute = '/territoires/automatisation/voglans-73329/';
const document = route => `<!doctype html><title>Projet</title><meta name="description" content="Décrire"><link rel="canonical" href="https://flex-web.fr${route}"><main><h1>Votre projet</h1><p>Texte initial.</p></main>`;

async function fixture(t, { sourceDate = '2026-09-01', withCommune = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'flexweb-cms-lastmod-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const routes = withCommune ? [siteRoute, automationRoute] : ['/premier/', '/second/'];
  const price = { version: 'fixture', amount: 29900 };
  const entries = routes.map(route => {
    const page = extractPage(document(route), route);
    return { collection: 'pages', sourceId: route, path: route, title: page.title, seoTitle: page.title, seoDescription: page.description, content: page.content, data: { renderHash: page.renderHash, additionalSections: [] } };
  });
  if (withCommune) entries.push({ collection: 'communes', sourceId: commune.code, path: '', title: commune.name, seoTitle: '', seoDescription: '', content: [], data: { facts: commune, additionalSections: [] } });
  for (const folder of ['.cms', 'cms', 'dist/sitemaps', 'apps/saas-platform/lib/automation', 'src/data/national']) await mkdir(path.join(root, folder), { recursive: true });
  for (const route of routes) {
    await mkdir(path.join(root, 'dist', route), { recursive: true });
    await writeFile(path.join(root, 'dist', route, 'index.html'), document(route));
  }
  for (const entry of entries) entry.baselineHash = baselineHash(entry);
  const manifest = { schemaVersion: 1, pricingFingerprint: hash(price), entries: entries.map(entry => ({ collection: entry.collection, sourceId: entry.sourceId, path: entry.path, ...(entry.data.renderHash ? { renderHash: entry.data.renderHash } : {}), baselineHash: entry.baselineHash })) };
  manifest.hash = hash(manifest);
  await writeFile(path.join(root, 'cms/baseline.json.gz'), gzipSync(JSON.stringify(manifest)));
  await writeFile(path.join(root, 'apps/saas-platform/lib/automation/public-quotes.json'), JSON.stringify(price));
  await writeFile(path.join(root, 'src/data/national/territorial-drafts.json'), JSON.stringify({ communes: [commune] }));
  const initialSitemap = `<urlset>${routes.map(route => `<url><loc>https://flex-web.fr${route}</loc>${sourceDate ? `<lastmod>${sourceDate}</lastmod>` : ''}</url>`).join('')}</urlset>`;
  const sitemapPath = path.join(root, 'dist/sitemaps/pages-1.xml');
  await writeFile(sitemapPath, initialSitemap);
  for (const entry of entries) Object.assign(entry, { baseManifestHash: manifest.hash, revision: 2, updatedAt: '2026-09-30T08:00:00Z' });
  async function render() {
    const payload = { schemaVersion: 1, sourceCommit: 'a'.repeat(40), pricingFingerprint: manifest.pricingFingerprint, baseManifestHash: manifest.hash, entries };
    await writeFile(path.join(root, '.cms/snapshot.json'), JSON.stringify({ ...payload, id: hash(payload), createdAt: '2026-10-01T08:00:00Z' }));
    const report = await renderSnapshot({ root });
    return { report, sitemap: await readFile(sitemapPath, 'utf8') };
  }
  return { root, routes, entries, initialSitemap, render };
}

const changePage = entry => { entry.content[1].children[0].text = 'Précisions utiles sur ce projet.'; };
const addCommuneNote = entry => { entry.data.additionalSections = [{ title: 'Contexte local', text: 'Une information territoriale vérifiée.' }]; };
const dateFor = (xml, route) => [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].find(match => match[1].includes(`<loc>https://flex-web.fr${route}</loc>`))?.[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];

test('unchanged CMS pages preserve sitemap bytes and have no changedRoutes', async t => {
  const f = await fixture(t);
  const { report, sitemap } = await f.render();
  assert.equal(report.pages, 0);
  assert.deepEqual(report.changedRoutes, []);
  assert.equal(sitemap, f.initialSitemap);
  assert.equal(await readFile(path.join(f.root, 'dist/premier/index.html'), 'utf8'), document('/premier/'));
});

test('a CMS edit preserves a newer source lastmod including its timestamp', async t => {
  const f = await fixture(t, { sourceDate: '2026-10-01T12:00:00Z' });
  changePage(f.entries[0]);
  const { report, sitemap } = await f.render();
  assert.deepEqual(report.changedRoutes, ['/premier/']);
  assert.equal(dateFor(sitemap, '/premier/'), '2026-10-01T12:00:00Z');
});

test('a newer CMS edit advances only the page it actually changes', async t => {
  const f = await fixture(t);
  changePage(f.entries[0]);
  const { report, sitemap } = await f.render();
  assert.equal(report.pages, 1);
  assert.equal(dateFor(sitemap, '/premier/'), '2026-09-30');
  assert.equal(dateFor(sitemap, '/second/'), '2026-09-01');
});

test('a date is added only for an actual edit when the sitemap has no lastmod', async t => {
  const f = await fixture(t, { sourceDate: null });
  changePage(f.entries[0]);
  const { sitemap } = await f.render();
  assert.equal(dateFor(sitemap, '/premier/'), '2026-09-30');
  assert.equal(dateFor(sitemap, '/second/'), undefined);
});

test('an earlier commune revision cannot replace the newer page revision date', async t => {
  const f = await fixture(t, { withCommune: true });
  changePage(f.entries[0]);
  addCommuneNote(f.entries[2]);
  f.entries[2].updatedAt = '2026-09-20T08:00:00Z';
  const { report, sitemap } = await f.render();
  assert.equal(report.pages, 2);
  assert.deepEqual(report.changedRoutes, [siteRoute, automationRoute]);
  assert.equal(dateFor(sitemap, siteRoute), '2026-09-30');
  assert.equal(dateFor(sitemap, automationRoute), '2026-09-20');
  const html = await readFile(path.join(f.root, 'dist', siteRoute, 'index.html'), 'utf8');
  assert.match(html, /Précisions utiles sur ce projet/);
  assert.match(html, /Une information territoriale vérifiée/);
});

test('a newer commune revision advances both changed territorial pages', async t => {
  const f = await fixture(t, { withCommune: true });
  changePage(f.entries[0]);
  addCommuneNote(f.entries[2]);
  f.entries[2].updatedAt = '2026-10-01T08:00:00Z';
  const { sitemap } = await f.render();
  assert.equal(dateFor(sitemap, siteRoute), '2026-10-01');
  assert.equal(dateFor(sitemap, automationRoute), '2026-10-01');
});

test('an empty commune revision cannot refresh a modified page or its unchanged sibling', async t => {
  const f = await fixture(t, { withCommune: true });
  changePage(f.entries[0]);
  f.entries[2].updatedAt = '2026-10-01T08:00:00Z';
  const { report, sitemap } = await f.render();
  assert.deepEqual(report.changedRoutes, [siteRoute]);
  assert.equal(dateFor(sitemap, siteRoute), '2026-09-30');
  assert.equal(dateFor(sitemap, automationRoute), '2026-09-01');
});
