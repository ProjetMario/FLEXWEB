import {draftPreviewEnabled,draftData} from '../../../lib/seo/territorial-drafts.mjs';
import {territoryRecords} from '../../../lib/seo/territorial-directory.mjs';
export function getStaticPaths(){return draftPreviewEnabled()?[{params:{fichier:'catalogue'}}]:[];}
export function GET(){return new Response(JSON.stringify({version:1,sourceDate:draftData().retrievedAt,records:territoryRecords()}),{headers:{'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow'}});}
