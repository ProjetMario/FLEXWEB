import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {enrichmentData,enrichedTerritory,localInsights,localQuestions} from '../../src/lib/seo/territorial-insights.mjs';
import {draftData,draftPath,draftContent} from '../../src/lib/seo/territorial-drafts.mjs';
const draft=draftData(),enrichment=enrichmentData();
const reviewed=JSON.parse(readFileSync('src/data/national/articles.json'));
const groups=new Map(),facts=new Set(),paths=new Set();
const hash=s=>createHash('sha256').update(s).digest('hex');
let count=0;
for(const c of draft.communes){const e=enrichedTerritory(c.code);assert(e,`Missing ${c.code}`);facts.add(hash(JSON.stringify(e)));
 for(const axis of ['sites','automatisation']){
  const route=draftPath(axis,c),insights=localInsights(axis,c,e),questions=localQuestions(axis,c,e);assert(!paths.has(route));paths.add(route);
  assert.equal(insights.length,3);assert.equal(questions.length,3);
  for(const item of insights)assert(item.fact&&item.action&&item.check);
  // Count shared editorial methods separately from local factual differences.
  // More data or a unique URL is not an editorial approval.
  const method=hash(draftContent(axis,c).sections.filter((_,i)=>axis==='sites'?i!==1:i!==2).map(s=>s[1]).join('\n'));
  groups.set(method,(groups.get(method)||0)+1);
  count++;
 }
}
assert.equal(count+reviewed.length,20000);assert.equal(facts.size,9994);
const report={articles:20000,enrichedTerritorialArticles:count,reviewedEditorialArticles:reviewed.length,reviewRequired:count,uniqueTerritorialRecords:facts.size,uniquePaths:paths.size,sharedMethodFamilies:groups.size,largestSharedMethodFamily:Math.max(...groups.values()),coverage:enrichment.coverage,readyForProduction:false,reason:'Local facts and functional guides improve utility. Shared methods and a lack of individual editorial evidence still require review; geographic differences alone do not prove distinct SEO intent.',source:enrichment.source,sourceSha256:enrichment.sourceSha256};
writeFileSync('outputs/seo-national-20260924/enrichment-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
