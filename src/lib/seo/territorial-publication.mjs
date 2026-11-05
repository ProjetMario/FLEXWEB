import {draftEntries,draftGroups,additionalEntries,additionalGroups,draftPath,draftHubPath} from './territorial-drafts.mjs';
import {territoryDepartments} from './territorial-directory.mjs';
import {territorialDossier} from './territorial-editorial.mjs';
// Publication requested on this date. Keep this fixed until content changes.
export const territorialPublicationDate='2026-09-25';
const updatedNavigation=new Map([
 ['/territoires/','2026-11-05'],
 ['/territoires/departements/38/','2026-10-08'],
]);
export function territorialUrls(){
 const item=(url,family)=>({url,family,lastmod:updatedNavigation.get(url)??(family==='catalogue'&&/^\/territoires\/sites\/(?:page\/\d+\/)?$/.test(url)?'2026-11-05':family==='catalogue'&&/^\/territoires\/(?:applications|crm)\//.test(url)?'2026-11-05':territorialPublicationDate)});
 return [
  item('/territoires/','catalogue'),
  ...territoryDepartments().map(d=>item(`/territoires/departements/${d.code.toLowerCase()}/`,'catalogue')),
  ...[...draftGroups(),...additionalGroups()].map(g=>item(draftHubPath(g.axis,g.page),'catalogue')),
  ...[...draftEntries(),...additionalEntries()].map(e=>({...item(draftPath(e.axis,e.commune),`fiches-${e.axis}`),lastmod:territorialDossier(e.axis,e.commune.code)?.verifiedAt??(['applications','crm'].includes(e.axis)?'2026-11-05':territorialPublicationDate)})),
 ];
}
