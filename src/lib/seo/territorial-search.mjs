export const issueLabels={sharedPostal:'Code postal partagé',multiplePostal:'Plusieurs codes postaux',homonym:'Nom de commune partagé',crossDepartment:'Voisin dans un autre département',missingEpci:'Intercommunalité non renseignée'};
export const normalizeQuery=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/[^a-z0-9]+/g,' ').trim();
export function prepareSearchRecords(records){return records.map(r=>({...r,nameText:normalizeQuery(r.name),searchText:normalizeQuery([r.name,r.code,r.department,r.departmentCode,...r.postalCodes].join(' '))})).sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.code.localeCompare(b.code));}
export function searchTerritories(records,{q='',department='',issue='',page=1,pageSize=20}={}){
 const query=normalizeQuery(q),tokens=query.split(' ').filter(Boolean);
 const matches=records.filter(r=>(!department||r.departmentCode===department)&&(!issue||!!r.flags[issue])&&tokens.every(t=>r.searchText.includes(t)));
 if(query){const rank=r=>r.nameText===query?0:normalizeQuery(r.code)===query?1:r.postalCodes.some(code=>normalizeQuery(code)===query)?1:r.nameText.startsWith(query)?2:tokens.every(t=>r.nameText.includes(t))?3:4;matches.sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,'fr')||a.code.localeCompare(b.code));}
 const size=Math.min(50,Math.max(1,Math.floor(Number(pageSize)||20))),pages=Math.max(1,Math.ceil(matches.length/size));
 const current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
 return {total:matches.length,page:current,pages,items:matches.slice((current-1)*size,current*size)};
}
