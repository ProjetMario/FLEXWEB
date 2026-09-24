import {createHash} from 'node:crypto';
export function reviewHash(a){
 const fields=['axis','slug','title','description','intent','audience','problem','outcome','intro','sections','example','checklist','limits','related','sources','locationTerms'];
 return createHash('sha256').update(JSON.stringify(Object.fromEntries(fields.map(k=>[k,a[k]])))).digest('hex');
}
export const isPublishable=a=>a.publicationSelected===true&&a.status==='reviewed'&&a.reviewHash===reviewHash(a);
export const intentKey=a=>[a.audience,a.problem,a.outcome].map(s=>(s||'').trim().toLowerCase()).join('|');
