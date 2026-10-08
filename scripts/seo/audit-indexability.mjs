#!/usr/bin/env node
/** Read-only, restartable public sitemap audit. No page bodies or credentials are saved.
 * node scripts/seo/audit-indexability.mjs --output /tmp/audit [--sitemap https://flex-web.fr/sitemap.xml]
 * Resume reuses receipts for the same sitemap manifest. Use a new output directory to recheck production.
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, truncate, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSitemap } from './read-sitemap.mjs';
import { parse } from 'parse5';

const digest = value => createHash('sha256').update(value).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function descendants(node) {
  return [node, ...(node.childNodes ?? []).flatMap(descendants)];
}
function nodeText(node) {
  if (['script', 'style', 'noscript', 'template'].includes(node.tagName)) return '';
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes ?? []).map(nodeText).join(' ');
}
function blocked(value) { return /(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(value); }
export function headerDirectives(value) {
  const rules = []; let agent = 'robots';
  for (const segment of value.split(',')) {
    const directive = segment.trim();
    const prefix = /^([a-z][a-z\d_-]*|\*)\s*:\s*(.*)$/i.exec(directive);
    if (prefix && !['unavailable_after', 'max-snippet', 'max-image-preview', 'max-video-preview'].includes(prefix[1].toLowerCase())) {
      agent = prefix[1].toLowerCase(); rules.push({ agent, value: prefix[2] });
    } else rules.push({ agent, value: directive });
  }
  return rules;
}
export function inspectHtml(html, finalUrl, headerRobots = '') {
  const document = parse(html);
  const all = descendants(document);
  const head = all.find(node => node.tagName === 'head');
  const headNodes = head ? descendants(head) : [];
  const canonicals = []; const robots = [];
  for (const node of headNodes) {
    const attrs = Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]));
    if (node.tagName === 'link' && (attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')) {
      try { canonicals.push(attrs.href ? new URL(attrs.href, finalUrl).href : null); } catch { canonicals.push(null); }
    }
    if (node.tagName === 'meta' && ['robots', 'googlebot', 'bingbot'].includes((attrs.name ?? '').toLowerCase())) {
      robots.push({ agent: attrs.name.toLowerCase(), value: attrs.content ?? '' });
    }
  }
  const directives = [...robots, ...headerDirectives(headerRobots)];
  const indexableBy = agent => !directives.some(rule => ['robots', '*', 'all', agent].includes(rule.agent) && blocked(rule.value));
  const googleIndexable = indexableBy('googlebot'); const bingIndexable = indexableBy('bingbot');
  const issues = [];
  if (canonicals.length !== 1) issues.push(canonicals.length ? 'multiple_canonicals' : 'missing_canonical');
  if (canonicals.length === 1 && canonicals[0] !== finalUrl) issues.push('canonical_not_self');
  if (canonicals.includes(null)) issues.push('invalid_canonical');
  if (!googleIndexable || !bingIndexable) issues.push('noindex');
  const title = Buffer.from(nodeText(headNodes.find(node => node.tagName === 'title') ?? {}).replace(/\s+/g, ' ').trim()).toString('utf8');
  if (!title) issues.push('missing_title');
  const main = all.find(node => node.tagName === 'main') ?? all.find(node => node.tagName === 'body') ?? document;
  const content = nodeText(main).replace(/\s+/g, ' ').trim();
  return { title, canonicals, robots, headerRobots, googleIndexable, bingIndexable, textWords: content.split(/\s+/).filter(Boolean).length, textSha256: digest(content), issues };
}
export const analyseDocument = inspectHtml;

export function createReader({ fetchImpl = fetch, timeoutMs = 30000, retries = 3, retryBaseMs = 1500, maxRetryMs = 60000, maxBytes = 2_000_000, onRetry = () => {} } = {}) {
  let backoffUntil = 0;
  return async function read(url) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (backoffUntil > Date.now()) await sleep(backoffUntil - Date.now());
      try {
        const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'FlexWeb-Indexability-Audit/1.0 (+https://flex-web.fr/)', accept: 'text/html, application/xml;q=0.9, */*;q=0.1' } });
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          const retryAfter = response.headers.get('retry-after');
          const specified = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : 0;
          const delay = Math.min(maxRetryMs, Math.max(specified || 0, retryBaseMs * 2 ** attempt));
          backoffUntil = Math.max(backoffUntil, Date.now() + delay);
          await response.body?.cancel();
          onRetry({ url, status: response.status, attempt: attempt + 1, delay });
          continue;
        }
        const chunks = []; let bytes = 0;
        if (response.body) for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (bytes > maxBytes) throw new Error('Response exceeds audit size limit');
          chunks.push(chunk);
        }
        return { status: response.status, headers: response.headers, body: Buffer.concat(chunks).toString('utf8'), bytes, attempts: attempt + 1 };
      } catch (error) {
        if (attempt === retries) throw error;
        const delay = Math.min(maxRetryMs, retryBaseMs * 2 ** attempt);
        backoffUntil = Math.max(backoffUntil, Date.now() + delay);
        onRetry({ url, error: error.message, attempt: attempt + 1, delay });
      }
    }
  };
}

export async function inspectUrl(url, read, { allowedOrigin = new URL(url).origin, maxRedirects = 10 } = {}) {
  const started = Date.now(); const redirects = []; const visited = new Set();
  const record = { url, checkedAt: new Date().toISOString(), googleStatus: 'unknown', bingStatus: 'unknown' };
  let current = url;
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (visited.has(current)) throw new Error('Redirect loop');
      visited.add(current);
      const response = await read(current);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without location');
        const destination = new URL(location, current).href;
        redirects.push({ status: response.status, from: current, to: destination });
        if (new URL(destination).origin !== allowedOrigin) return { ...record, status: response.status, finalUrl: destination, redirects, issues: ['redirect', 'foreign_redirect'], elapsedMs: Date.now() - started };
        current = destination;
        continue;
      }
      const type = response.headers.get('content-type') ?? '';
      const inspection = /text\/html|application\/xhtml\+xml/i.test(type) ? inspectHtml(response.body, current, response.headers.get('x-robots-tag') ?? '') : { issues: ['not_html'] };
      if (response.status !== 200) inspection.issues.push(`http_${response.status}`);
      if (redirects.length) inspection.issues.push('redirect');
      return { ...record, status: response.status, finalUrl: current, contentType: type, bytes: response.bytes, attempts: response.attempts, redirects, ...inspection, elapsedMs: Date.now() - started };
    }
    throw new Error('Too many redirects');
  } catch (error) {
    return { ...record, finalUrl: current, redirects, issues: ['fetch_error'], error: error.message, elapsedMs: Date.now() - started };
  }
}

export function summarize(records, manifest) {
  const issues = {}; const statuses = {}; const fingerprints = new Map();
  for (const row of records) {
    statuses[row.status ?? 'error'] = (statuses[row.status ?? 'error'] ?? 0) + 1;
    for (const issue of row.issues) issues[issue] = (issues[issue] ?? 0) + 1;
    if (row.textSha256) {
      const urls = fingerprints.get(row.textSha256) ?? [];
      urls.push(row.url); fingerprints.set(row.textSha256, urls);
    }
  }
  return { generatedAt: new Date().toISOString(), sitemap: manifest.sitemap, sitemapSha256: manifest.sha256, total: manifest.urls.length, completed: records.length, complete: records.length === manifest.urls.length, passes: records.filter(row => row.issues.length === 0).length, statuses, issues, exactContentDuplicateGroups: [...fingerprints.values()].filter(urls => urls.length > 1), engineStatus: 'Unknown unless independently verified in Search Console or Bing Webmaster Tools. HTTP eligibility is not confirmed indexation.', robotsTxtCheck: 'Robots.txt and crawler-specific CDN rules must be verified separately.', sitemapDuplicates: manifest.duplicates };
}

export async function runAudit({ sitemap = 'https://flex-web.fr/sitemap.xml', output, concurrency = 4, max = Infinity, read = createReader(), progress = console.log } = {}) {
  if (!output) throw new Error('--output is required');
  if (max !== Infinity && (!Number.isInteger(max) || max < 0)) throw new Error('Max must be a non-negative integer');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
  await mkdir(output, { recursive: true });
  const rawUrls = await readSitemap(sitemap, async url => {
    const response = await read(url);
    if (response.status !== 200) throw new Error(`Sitemap returned ${response.status}: ${url}`);
    return response.body;
  });
  const urls = [...new Set(rawUrls)];
  const origin = new URL(sitemap).origin;
  const urlSet = new Set(urls);
  if (urls.some(url => new URL(url).origin !== origin)) throw new Error('Sitemap contains a foreign URL');
  const manifest = { sitemap, sha256: digest(urls.join('\n')), retrievedAt: new Date().toISOString(), duplicates: rawUrls.length - urls.length, urls };
  const manifestPath = resolve(output, 'manifest.json');
  let previous;
  try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous && (previous.sha256 !== manifest.sha256 || previous.sitemap !== sitemap)) throw new Error('Sitemap changed. Use a new output directory to retain previous evidence.');
  if (!previous) {
    await writeFile(manifestPath + '.tmp', JSON.stringify(manifest));
    await rename(manifestPath + '.tmp', manifestPath);
  }
  const receiptsPath = resolve(output, 'receipts.jsonl');
  const records = new Map();
  try {
    const raw = await readFile(receiptsPath);
    const lines = raw.toString('utf8').split('\n');
    let badTail = false;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try { const row = JSON.parse(lines[i]); if (urlSet.has(row.url)) records.set(row.url, row); }
      catch (error) { if (i !== lines.length - 1) throw error; badTail = true; }
    }
    // Never rewrite valid receipts: a disk-full failure must not destroy prior evidence.
    if (badTail) await truncate(receiptsPath, raw.lastIndexOf(10) + 1);
    else if (raw.length && raw[raw.length - 1] !== 10) await appendFile(receiptsPath, '\n');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const pending = urls.filter(url => !records.has(url)).slice(0, max);
  let index = 0; let writeQueue = Promise.resolve();
  progress(`Audit ${urls.length} URLs: ${records.size} receipts restored, ${pending.length} pending, concurrency ${concurrency}.`);
  const checkpoint = async () => {
    const path = resolve(output, 'summary.json');
    await writeFile(path + '.tmp', JSON.stringify(summarize([...records.values()], manifest), null, 2));
    await rename(path + '.tmp', path);
  };
  await checkpoint();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < pending.length) {
      const url = pending[index++];
      const result = await inspectUrl(url, read, { allowedOrigin: origin });
      records.set(url, result);
      const count = records.size;
      writeQueue = writeQueue.then(async () => {
        await appendFile(receiptsPath, JSON.stringify(result) + '\n');
        if (count % 250 === 0) await checkpoint();
      });
      await writeQueue;
      if (count % 250 === 0 || result.issues.length) progress(`${count}/${urls.length} ${result.issues.length ? result.issues.join(',') + ' ' + url : 'checked'}`);
    }
  }));
  await writeQueue; await checkpoint();
  return summarize([...records.values()], manifest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!['sitemap', 'output', 'concurrency', 'max'].includes(key) || !args[i + 1]) throw new Error('Usage: --output DIR [--sitemap URL] [--concurrency 1-4] [--max N]');
    options[key] = ['concurrency', 'max'].includes(key) ? Number(args[i + 1]) : args[i + 1];
  }
  console.log(JSON.stringify(await runAudit(options), null, 2));
}
