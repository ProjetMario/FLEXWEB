import {draftData,slugify} from './territorial-drafts.mjs';
import {enrichedTerritory} from './territorial-insights.mjs';
import {territoryAssessment} from './territorial-dossier.mjs';
let records;
export const territoryRecords=()=>records??=draftData().communes.map(c=>({code:c.code,name:c.name,department:c.department,departmentCode:c.departmentCode,postalCodes:c.postalCodes,slug:`${slugify(c.name)}-${c.code.toLowerCase()}`,flags:territoryAssessment(c,enrichedTerritory(c.code))}));
export function territoryDepartments(){const groups=new Map();for(const r of territoryRecords()){if(!groups.has(r.departmentCode))groups.set(r.departmentCode,{code:r.departmentCode,name:r.department,items:[]});groups.get(r.departmentCode).items.push(r);}return [...groups.values()].sort((a,b)=>a.code.localeCompare(b.code,'fr',{numeric:true})).map(g=>({...g,items:g.items.sort((a,b)=>a.name.localeCompare(b.name,'fr'))}));}
