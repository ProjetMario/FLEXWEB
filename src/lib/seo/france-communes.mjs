import {readFileSync} from 'node:fs';
import path from 'node:path';
import {catalogueData,draftEntries,draftPath,slugify} from './territorial-drafts.mjs';
let cached,groupsCache,oldCache;
export const franceData=()=>cached??=JSON.parse(readFileSync(path.resolve('src/data/national/communes-france.json'),'utf8'));
const historical=()=>oldCache??=new Map(catalogueData().communes.map(c=>[c.code,c]));
export const franceServicePath=(axis,c)=>draftPath(axis,historical().get(c.code)??c);
export function franceNewEntries(){const current=new Set(draftEntries().map(e=>draftPath(e.axis,e.commune)));return ['sites','automatisation'].flatMap(axis=>franceData().communes.filter(c=>!historical().has(c.code)&&!current.has(draftPath(axis,c))).map(commune=>({axis,commune,slug:`${slugify(commune.name)}-${commune.code.toLowerCase()}`,national:true})));}
export const franceHub=(code,page=1)=>code?`/communes-france/${code.toLowerCase()}/${page>1?`page/${page}/`:''}`:'/communes-france/';
export function franceDepartments(){
 if(groupsCache)return groupsCache;
 const groups=new Map();for(const c of franceData().communes){if(!groups.has(c.departmentCode))groups.set(c.departmentCode,{code:c.departmentCode,name:c.department,communes:[]});groups.get(c.departmentCode).communes.push(c);}
 return groupsCache=[...groups.values()].sort((a,b)=>a.code.localeCompare(b.code,'fr',{numeric:true})).map(g=>({...g,communes:g.communes.sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.code.localeCompare(b.code))}));
}
export function franceGroups(){return franceDepartments().flatMap(g=>Array.from({length:Math.ceil(g.communes.length/100)},(_,i)=>({code:g.code,name:g.name,page:i+1,total:Math.ceil(g.communes.length/100),communes:g.communes.slice(i*100,(i+1)*100)})));}
export function franceUrls(){const item=(url,family)=>({url,family,lastmod:'2026-11-05'});return [item(franceHub(),'communes-france'),...franceGroups().map(g=>item(franceHub(g.code,g.page),'communes-france')),...franceNewEntries().map(e=>item(draftPath(e.axis,e.commune),`france-${e.axis}`))];}
