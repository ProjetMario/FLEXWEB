import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReader, inspectHtml, inspectUrl, runAudit } from '../../scripts/seo/audit-indexability.mjs';

const page = url => `<html><head><title>Exemple &amp; preuve</title><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"></head><body><main>Contenu utile et vérifiable</main></body></html>`;
test('detects bot-specific noindex and canonical inconsistencies, ignores script-only content', () => {
  const result = inspectHtml('<head><title>Page</title><link rel="canonical" href="/other/"><meta name="googlebot" content="noindex, follow"></head><main>Texte<script>private</script></main>', 'https://example.test/page/');
  assert.deepEqual(result.issues, ['canonical_not_self', 'noindex']);
  assert.equal(result.textWords, 1);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(inspectHtml(page('https://example.test/'), 'https://example.test/', 'noindex').issues.includes('noindex'));
});

test('crawls sitemap with bounded concurrency, retries failures, records redirects and resumes without refetching pages', async () => {
  let origin; let active = 0; let highWater = 0; const hits = new Map();
  const server = createServer(async (req, res) => {
    hits.set(req.url, (hits.get(req.url) ?? 0) + 1);
    active++; highWater = Math.max(active, highWater);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    if (req.url === '/sitemap.xml') {
      res.setHeader('content-type', 'application/xml');
      return res.end(`<sitemapindex><sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap></sitemapindex>`);
    }
    if (req.url === '/sitemap-pages.xml') {
      res.setHeader('content-type', 'application/xml');
      return res.end(`<urlset>${['/', '/retry/', '/redirect/', '/noindex/', '/missing/'].map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`);
    }
    if (req.url === '/retry/' && hits.get(req.url) === 1) { res.statusCode = 503; return res.end('temporary'); }
    if (req.url === '/redirect/') { res.statusCode = 301; res.setHeader('location', '/'); return res.end(); }
    if (req.url === '/missing/') res.statusCode = 404;
    if (req.url === '/noindex/') res.setHeader('x-robots-tag', 'noindex');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(page(origin + req.url));
  });
  const output = await mkdtemp(join(tmpdir(), 'indexability-test-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const read = createReader({ retryBaseMs: 1, maxRetryMs: 2 });
    const first = await runAudit({ sitemap: origin + '/sitemap.xml', output, max: 2, read, progress: () => {} });
    assert.equal(first.complete, false);
    const result = await runAudit({ sitemap: origin + '/sitemap.xml', output, read, progress: () => {} });
    assert.equal(result.complete, true); assert.equal(result.completed, 5);
    assert.equal(result.issues.redirect, 1); assert.equal(result.issues.noindex, 1); assert.equal(result.issues.http_404, 1);
    assert.equal(hits.get('/retry/'), 2);
    assert.equal(hits.get('/'), 2); // One original request, one redirect destination; no repeat on resume.
    assert.ok(highWater <= 4);
    const receipts = (await readFile(join(output, 'receipts.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(receipts.length, 5);
    assert.ok(receipts.every(row => row.googleStatus === 'unknown' && !('body' in row)));
    const prior = new Map(hits);
    await runAudit({ sitemap: origin + '/sitemap.xml', output, read, progress: () => {} });
    assert.equal(hits.get('/retry/'), prior.get('/retry/'));
  } finally { await new Promise(resolve => server.close(resolve)); await rm(output, { recursive: true, force: true }); }
});

test('redirect loops and external destinations do not produce false successful receipts', async () => {
  const read = async url => ({ status: 301, headers: new Headers({ location: url }), bytes: 0, body: '' });
  assert.deepEqual((await inspectUrl('https://example.test/', read)).issues, ['fetch_error']);
  const foreign = await inspectUrl('https://example.test/', async () => ({ status: 302, headers: new Headers({ location: 'https://other.test/' }) }));
  assert.ok(foreign.issues.includes('foreign_redirect'));
});

test('HTML parser ignores fake robots markup in scripts/comments and handles attribute order/case', () => {
  const html = `<head><script>const example = '<meta name="robots" content="noindex">';</script><!-- <meta name="robots" content="noindex"> --><LINK HREF="https://example.test/" REL="canonical"><META CONTENT="index" NAME="ROBOTS"><title>Visible</title></head><main>Content</main>`;
  const result = inspectHtml(html, 'https://example.test/');
  assert.deepEqual(result.issues, []);
  assert.equal(result.googleIndexable, true); assert.equal(result.bingIndexable, true);
});

test('robot-specific header and meta directives retain separate Google and Bing eligibility', () => {
  const html = page('https://example.test/');
  const googleOnly = inspectHtml(html, 'https://example.test/', 'googlebot: noindex, nofollow, bingbot: index');
  assert.equal(googleOnly.googleIndexable, false); assert.equal(googleOnly.bingIndexable, true);
  const bingOnly = inspectHtml(html.replace('</head>', '<meta name="bingbot" content="none"></head>'), 'https://example.test/', 'googlebot: index');
  assert.equal(bingOnly.googleIndexable, true); assert.equal(bingOnly.bingIndexable, false);
  assert.deepEqual(inspectHtml(html, 'https://example.test/', 'otherbot: noindex').issues, []);
});
