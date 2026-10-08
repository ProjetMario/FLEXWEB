import {draftEntries,draftGroups,draftPath,draftHubPath} from './territorial-drafts.mjs';
import {territoryDepartments} from './territorial-directory.mjs';
import {territorialDossier} from './territorial-editorial.mjs';
// Publication requested on this date. Keep this fixed until content changes.
export const territorialPublicationDate='2026-09-25';
const updatedNavigation=new Map([
 ['/territoires/','2026-10-08'],
 ['/territoires/departements/38/','2026-10-08'],
]);
export function territorialUrls(){
 const item=(url,family)=>({url,family,lastmod:updatedNavigation.get(url)??territorialPublicationDate});
 return [
  item('/territoires/','catalogue'),
  ...territoryDepartments().map(d=>item(`/territoires/departements/${d.code.toLowerCase()}/`,'catalogue')),
  ...draftGroups().map(g=>item(draftHubPath(g.axis,g.page),'catalogue')),
  ...draftEntries().map(e=>({...item(draftPath(e.axis,e.commune),`fiches-${e.axis}`),lastmod:territorialDossier(e.axis,e.commune.code)?.verifiedAt??territorialPublicationDate})),
 ];
}
