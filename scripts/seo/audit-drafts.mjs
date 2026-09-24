import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {draftEntries,draftData,draftPath} from '../../src/lib/seo/territorial-drafts.mjs';
process.env.FLEXWEB_DRAFT_PREVIEW='1';process.env.CONTEXT='production';assert.equal(draftEntries().length,0);
process.env.CONTEXT='deploy-preview';
const entries=draftEntries(),reviewed=JSON.parse(readFileSync('src/data/national/articles.json'));
assert.equal(entries.length,19988);assert.equal(new Set(draftData().communes.map(c=>c.code)).size,9994);
const paths=new Set(entries.map(e=>draftPath(e.axis,e.commune)));assert.equal(paths.size,19988);
let links=0;
for(const entry of entries){const route=draftPath(entry.axis,entry.commune),html=readFileSync(`dist${route}index.html`,'utf8');assert.match(html,/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/);assert(html.includes('Brouillon enrichi'));assert(html.includes('Ce que les données'));assert(html.includes('territory-planner'));assert(html.includes('project-guides'));assert(html.includes('https://geo.api.gouv.fr/communes/'+entry.commune.code));for(const match of html.matchAll(/href="(\/[^"?#]*)/g)){const href=match[1];if(!href.endsWith('/'))continue;assert(existsSync(`dist${href}index.html`),`Missing ${href} on ${route}`);links++;}}
console.log(JSON.stringify({articles:entries.length+reviewed.length,reviewed:reviewed.length,drafts:entries.length,uniqueDraftPaths:paths.size,checkedLinks:links,productionDrafts:0},null,2));
