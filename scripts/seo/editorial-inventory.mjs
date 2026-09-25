import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {draftData,draftPath} from '../../src/lib/seo/territorial-drafts.mjs';
import {enrichedTerritory} from '../../src/lib/seo/territorial-insights.mjs';
import {isPublishable} from '../../src/lib/seo/editorial.mjs';
const articles=JSON.parse(readFileSync('src/data/national/articles.json')),data=draftData();
const rows=articles.map(a=>({id:'article:'+a.slug,originalUrl:'/ressources/'+a.axis+'/'+a.slug+'/',axis:a.axis,status:isPublishable(a)?'ready':'to-develop',destination:'/ressources/'+a.axis+'/'+a.slug+'/',reason:isPublishable(a)?'Article relu, empreinte courante et sélection explicite.':'Relecture ou sélection manquante.'}));
for(const c of data.communes)for(const axis of ['sites','automatisation']){
 const e=enrichedTerritory(c.code),priority=['73','74'].includes(c.departmentCode),ambiguous=e.homonyms.length||e.postalGroups.some(g=>g.totalCommunes>1);
 rows.push({id:`territory:${axis}:${c.code}`,originalUrl:draftPath(axis,c).replace('/territoires/','/preparation/'),publicUrl:draftPath(axis,c),publicationStatus:'published-catalogue',publicationDate:'2026-09-25',axis,status:priority?'to-develop':ambiguous?'to-document':'to-consolidate',destination:draftPath(axis,c),group:`${axis}:territorial-method:${c.departmentCode}`,reason:priority?'Priorité régionale historique ; rechercher un besoin local indépendant pour approfondir le contenu publié.':ambiguous?'Diagnostic d’adresse disponible ; preuve d’un besoin éditorial local distinct encore manquante.':'Méthode générique et aucune ambiguïté d’adresse relevée ; examiner le regroupement dans un guide de zone ou de besoin. Ces critères sont un tri, pas une décision de publication.'});
}
const counts=Object.fromEntries(['ready','to-develop','to-document','to-consolidate'].map(s=>[s,rows.filter(r=>r.status===s).length]));
mkdirSync('outputs/seo-national-20260924',{recursive:true});
writeFileSync('outputs/seo-national-20260924/editorial-inventory.json',JSON.stringify({target:20000,total:rows.length,counts,rows},null,2));
console.log(JSON.stringify({target:20000,total:rows.length,counts,retainedTerritorialIds:data.communes.length*2,newGuides:articles.length-data.reviewedArticles},null,2));
