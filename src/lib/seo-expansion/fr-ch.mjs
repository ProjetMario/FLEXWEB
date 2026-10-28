import {readFileSync} from 'node:fs';
import path from 'node:path';
import {draftData,draftPath} from '../seo/territorial-drafts.mjs';
export const audiences = ['particuliers','entreprises'];
export const expansionEnabled = () => process.env.FLEXWEB_FR_CH_EXPANSION === '1';
let cached;
export function inventory() {
  if (!cached) {
    const data=JSON.parse(readFileSync(path.resolve('src/data/seo-expansion/fr-ch-candidates.json'),'utf8'));
    if(data.status!=='draft-not-published'||data.locations.length!==15000||data.candidateCount!==30000)throw Error('Invalid France/Switzerland inventory');
    cached=data;
  }
  return cached;
}
export const candidatePath=(audience,location)=>`/projets-sites/${audience}/${location.slug}/`;
export const swissLanguages = ['fr','de','it'];
export const locationLanguage=location=>location.country==='CH'&&location.languageArea==='Allemand'?'de':location.country==='CH'&&location.languageArea==='Italien'?'it':'fr';
export function swissLanguagePath(audience,location,locale){
 if(location.country!=='CH'||!swissLanguages.includes(locale))throw Error('Invalid Swiss language route');
 return locale===locationLanguage(location)?candidatePath(audience,location):`/projets-sites/suisse/${locale}/${audience}/${location.slug}/`;
}
export function swissTranslations(){
 return candidates().filter(x=>x.location.country==='CH').flatMap(x=>swissLanguages.filter(locale=>locale!==locationLanguage(x.location)).map(locale=>({...x,locale,path:swissLanguagePath(x.audience,x.location,locale)})));
}
export function candidates() {
  const data=inventory();
  return audiences.flatMap(audience=>data.locations.map(location=>({audience,location,path:candidatePath(audience,location)})));
}
export function candidateLocations(country) {
 return inventory().locations.filter(location=>location.country===country);
}
export const directorySize=100;
export function directoryPath(country,page=1){return `/projets-sites/${country.toLowerCase()}/page/${page}/`;}
export function directoryGroups(){
 return ['FR','CH'].flatMap(country=>{
  const items=candidateLocations(country),total=Math.ceil(items.length/directorySize);
  return Array.from({length:total},(_,index)=>({country,page:index+1,total,items:items.slice(index*directorySize,(index+1)*directorySize)}));
 });
}

let existingFrench;
export function existingFrenchSite(location){
 if(location.country!=='FR')return null;
 existingFrench ??= new Map(draftData().communes.map(commune=>[commune.code,commune]));
 const commune=existingFrench.get(location.code);
 return commune?draftPath('sites',commune):null;
}
