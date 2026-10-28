import {PUBLIC_SITE_ID,requireDeploymentPolicy,requireRelease} from './release-core.mjs';

// Netlify CLI prompts even in CI when a production deployment is locked.
// Preserve the existing lock while using a new upload, never a restoration.
export async function uploadWithProductionLock({expected,expectedProductionId,currentProduction,unlock,lock,upload}){
 const before=await currentProduction();
 requireRelease(before.siteId===PUBLIC_SITE_ID&&before.id&&before.ready,'WRONG_OR_UNREADY_PRODUCTION');
 requireRelease(before.id===expectedProductionId,'PRODUCTION_CHANGED');
 requireDeploymentPolicy(before);
 try{
  if(before.locked)await unlock(before.id);
  const unlocked=await currentProduction();
  requireRelease(unlocked.id===before.id&&unlocked.ready,'PRODUCTION_CHANGED');
  requireDeploymentPolicy(unlocked);
  return await upload();
 }finally{
  if(before.locked){
   const current=await currentProduction();
   requireRelease(current.siteId===PUBLIC_SITE_ID&&current.id&&current.ready,'PRODUCTION_LOCK_UNCERTAIN');
   const ours=current.codeCommit===expected.codeCommit&&current.snapshotSha256===expected.snapshotSha256;
   requireRelease(current.id===before.id||ours,'PRODUCTION_CHANGED_DURING_LOCK');
   await lock(current.id);
   const confirmed=await currentProduction();
   requireRelease(confirmed.id===current.id&&confirmed.locked===true,'PRODUCTION_LOCK_NOT_RESTORED');
  }
 }
}
