import assert from 'node:assert/strict';
import { entrepreneurPages } from '../../src/data/geo/entrepreneurs';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4344';
assert.equal(entrepreneurPages.length,30);
assert.equal(new Set(entrepreneurPages.map(p=>p.path)).size,30);
assert.equal(new Set(entrepreneurPages.map(p=>p.title)).size,30);
assert.equal(new Set(entrepreneurPages.map(p=>p.description)).size,30);
for (const page of entrepreneurPages) {
 const response=await fetch(new URL(page.path,origin)); assert.equal(response.status,200,page.path);
 const html=await response.text();
 assert.equal((html.match(/<h1(?:\s|>)/gi)||[]).length,1,page.path);
 assert.match(html,/<html[^>]+lang="fr"/i,page.path);
 assert.match(html,/<link[^>]+rel="canonical"/i,page.path);
 assert.ok(html.includes(`https://flex-web.fr${page.path}`),page.path);
 assert.doesNotMatch(html,/<meta[^>]+content="[^"]*noindex/i,page.path);
 assert.ok(html.includes('FAQPage') && html.includes('BreadcrumbList'),page.path);
 assert.ok(html.includes('/demarrer/?service=site'),page.path);
 assert.ok(html.includes('<details'),page.path);
}
console.log(`Validated ${entrepreneurPages.length} entrepreneur pages`);
