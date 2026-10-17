import assert from 'node:assert/strict';
import {access, readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {parse} from 'parse5';
import {isProspectMockup} from '../cms/document-policy.mjs';
import {analyseDocument} from '../seo/audit-indexability.mjs';
import {readSitemap} from '../seo/read-sitemap.mjs';

const ORIGIN = 'https://flex-web.fr';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fixedRoots = ['api','sites','_next','.netlify','.well-known','preparation','territoires','ressources','sitemaps','journal','realisations','specialites','outils','assets','images','fonts','robots.txt','sitemap.xml','llms.txt','ai-overview.txt'];
const firstPart = value => value.split('/').find(Boolean);
function descendants(node) { return [node, ...(node.childNodes ?? []).flatMap(descendants)]; }
function attributes(node) { return Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value])); }
function visibleText(node) {
  if (['script','style','noscript','template'].includes(node.tagName)) return '';
  return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(visibleText).join(' ');
}

/** Reserve source routes before inspecting output: Astro may choose a static
 * route over the prospect catch-all, which must never silently hide a demo. */
export async function reservedRoots(root) {
  const reserved = new Set(fixedRoots);
  for (const item of await readdir(path.join(root,'src/pages'), {withFileTypes:true})) {
    if (item.name.startsWith('[')) continue;
    reserved.add(item.isDirectory() ? item.name : item.name.replace(/\.(astro|mdx?|[cm]?[jt]s)$/, ''));
  }
  for (const item of await readdir(path.join(root,'public'), {withFileTypes:true})) reserved.add(item.name);
  for (const item of await readdir(path.join(root,'src/content/locations'))) {
    if (!item.endsWith('.md')) continue;
    const source = await readFile(path.join(root,'src/content/locations',item),'utf8');
    const match = /^slug:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(source);
    assert(match, `Location without explicit slug: ${item}`);
    reserved.add(match[1]);
    reserved.add(match[1].replace(/^creation-site-internet-/, 'creation-application-mobile-'));
  }
  const redirectSource = await readFile(path.join(root,'public/_redirects'),'utf8');
  for (const line of redirectSource.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    for (const target of line.trim().split(/\s+/).slice(0,2)) {
      const pathname = target.startsWith('/') ? target : new URL(target).pathname;
      const part = firstPart(pathname); if (part) reserved.add(part);
    }
  }
  const manifest = JSON.parse(gunzipSync(await readFile(path.join(root,'cms/baseline.json.gz'))));
  for (const entry of manifest.entries) { const part = firstPart(entry.path ?? ''); if (part) reserved.add(part); }
  return reserved;
}

export async function auditProspects({root=process.cwd(), dist=path.join(root,'dist')}={}) {
  const prospects = JSON.parse(await readFile(path.join(root,'src/data/prospects.json'),'utf8'));
  assert(Array.isArray(prospects), 'Prospect registry must be an array');
  const reserved = await reservedRoots(root);
  const sitemap = new Set(await readSitemap(ORIGIN+'/sitemap.xml', url => readFile(path.join(dist,new URL(url).pathname),'utf8')));
  const seen = new Set();
  for (const prospect of prospects) {
    const publicFields = ['slug','name','activity','city','theme','headline','intro','services','sourceUrl','verifiedAt','batch','logo','heroImage','accent'];
    assert(Object.keys(prospect).every(key => publicFields.includes(key)), 'Private or unexpected field in public prospect registry');
    assert(typeof prospect.slug === 'string' && slugPattern.test(prospect.slug), 'Invalid prospect slug');
    assert(!reserved.has(prospect.slug), `Prospect collides with an existing route: ${prospect.slug}`);
    assert(!seen.has(prospect.slug), `Duplicate prospect slug: ${prospect.slug}`); seen.add(prospect.slug);
    const route = '/'+prospect.slug+'/'; const url = ORIGIN+route;
    const html = await readFile(path.join(dist,prospect.slug,'index.html'),'utf8');
    assert(isProspectMockup(html), `Prospect content marker missing: ${route}`);
    assert(!sitemap.has(url), `Prospect must not enter the public sitemap: ${route}`);
    const inspection = analyseDocument(html,url);
    assert.equal(inspection.googleIndexable,false, `Prospect must remain noindex for Google: ${route}`);
    assert.equal(inspection.bingIndexable,false, `Prospect must remain noindex for Bing: ${route}`);
    assert(inspection.robots.some(rule => rule.agent === 'robots' && /(?:^|[\s,;])nofollow(?:$|[\s,;])/i.test(rule.value)), `Prospect must remain nofollow: ${route}`);
    assert.deepEqual(inspection.issues.filter(issue => issue !== 'noindex'), [], `Prospect title/canonical: ${route}`);
    const nodes = descendants(parse(html)); const text = visibleText(nodes[0]).replace(/\s+/g,' ');
    assert.match(text,/maquette non officielle/i, `Unofficial mockup notice missing: ${route}`);
    assert.match(text,/Flex-Web/i, `Creator notice missing: ${route}`);
    assert.equal(nodes.filter(node => node.tagName === 'h1').length,1, `Single h1: ${route}`);
    assert.equal(nodes.filter(node => node.tagName === 'form').length,0, `Prospect demo must not collect client leads: ${route}`);
    assert(!/aggregateRating|"@type"\s*:\s*"Review"/.test(html), `Unverified review markup: ${route}`);
    const ids = new Set(nodes.map(node => attributes(node).id).filter(Boolean));
    const offers = new Set();
    for (const node of nodes.filter(node => node.tagName === 'a')) {
      const attrs = attributes(node); if (!attrs.href) continue;
      assert(!/[\u0000-\u0020\\]/.test(attrs.href), `Unsafe link characters: ${route}`);
      const target = new URL(attrs.href,url);
      assert(target.protocol === 'https:', `Unsafe or live prospect contact link: ${route}`);
      assert(!target.username && !target.password, `Credentials in link: ${route}`);
      if (target.origin !== ORIGIN) continue;
      assert(!target.pathname.startsWith('/api/') && !target.pathname.startsWith('/crm/'), `CRM link leaked: ${route}`);
      if (target.pathname === route && target.hash) assert(ids.has(decodeURIComponent(target.hash.slice(1))), `Missing demo anchor: ${route}${target.hash}`);
      if (target.pathname === '/demarrer/') {
        assert.equal(target.searchParams.get('maquette'),prospect.slug, `Quote attribution missing: ${route}`);
        const offer = target.searchParams.get('offre');
        const service = target.searchParams.get('service');
        const expected = {essentielle:'site',visibilite:'seo','crm-automation':'automation'};
        assert.equal(service,expected[offer], `Mismatched offer/service: ${route}`);
        offers.add(offer);
      }
      const destination = target.pathname.endsWith('/') ? path.join(dist,target.pathname,'index.html') : path.join(dist,target.pathname);
      await access(destination);
    }
    assert.deepEqual([...offers].sort(), ['crm-automation','essentielle','visibilite'], `Missing pack link: ${route}`);
    for (const node of nodes.filter(node => node.tagName === 'img')) {
      const attrs = attributes(node); assert(attrs.src && attrs.alt, `Image without source/description: ${route}`);
      const source = new URL(attrs.src,url);
      assert(source.protocol === 'https:' && !source.username && !source.password, `Unsafe image source: ${route}`);
      if (source.origin === ORIGIN) await access(path.join(dist,source.pathname));
    }
  }
  return {status:'passed',pages:prospects.length,noindexPages:prospects.length,sitemapEntries:0,routeCollisions:0};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditProspects().then(report => console.log(JSON.stringify(report))).catch(error => { console.error(error.message); process.exitCode=1; });
}
