import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadWithProductionLock} from './production-upload.mjs';
import {PUBLIC_SITE_ID} from './release-core.mjs';
function fixture(locked=true){
 let live={siteId:PUBLIC_SITE_ID,id:'before',ready:true,locked,gitBuildsStopped:true,nonGitProductionDeploysAllowed:true};
 const calls=[],expected={codeCommit:'expected-code',snapshotSha256:'expected-snapshot'};
 const input={expected,expectedProductionId:'before',currentProduction:async()=>({...live}),unlock:async id=>{calls.push('unlock:'+id);live.locked=false;},lock:async id=>{calls.push('lock:'+id);live.locked=true;},upload:async()=>{calls.push('upload');live={...live,id:'after',locked:false,...expected};return {...live};}};
 return {input,calls,get:()=>live,set:value=>{live={...live,...value};}};
}
test('a locked production is unlocked for the upload and the new deployment is locked afterwards',async()=>{
 const f=fixture();const result=await uploadWithProductionLock(f.input);assert.equal(result.id,'after');assert.deepEqual(f.calls,['unlock:before','upload','lock:after']);assert.equal(f.get().locked,true);
});
test('an unlocked production does not gain an unrequested lock',async()=>{
 const f=fixture(false);await uploadWithProductionLock(f.input);assert.deepEqual(f.calls,['upload']);assert.equal(f.get().locked,false);
});
test('an upload failure re-locks the original production without restoring a deployment',async()=>{
 const f=fixture();f.input.upload=async()=>{f.calls.push('upload');throw Error('upload failed');};await assert.rejects(uploadWithProductionLock(f.input),/upload failed/);assert.deepEqual(f.calls,['unlock:before','upload','lock:before']);assert.equal(f.get().id,'before');
});
test('a lost unlock response re-locks the original production without uploading',async()=>{
 const f=fixture();f.input.unlock=async()=>{f.calls.push('unlock');f.set({locked:false});throw Error('response lost');};await assert.rejects(uploadWithProductionLock(f.input),/response lost/);assert.deepEqual(f.calls,['unlock','lock:before']);assert.equal(f.get().locked,true);
});
test('a lost successful upload response still locks the matching new production',async()=>{
 const f=fixture();const upload=f.input.upload;f.input.upload=async()=>{await upload();throw Error('response lost');};await assert.rejects(uploadWithProductionLock(f.input),/response lost/);assert.deepEqual(f.calls,['unlock:before','upload','lock:after']);
});
test('a concurrent unrelated production is never locked or overwritten',async()=>{
 const f=fixture();f.input.upload=async()=>{f.set({id:'someone-else',codeCommit:'other-code'});throw Error('response lost');};await assert.rejects(uploadWithProductionLock(f.input),/PRODUCTION_CHANGED_DURING_LOCK/);assert.deepEqual(f.calls,['unlock:before']);
});
test('a lock response without an effective lock cannot be acknowledged',async()=>{
 const f=fixture();f.input.lock=async id=>f.calls.push('lock:'+id);await assert.rejects(uploadWithProductionLock(f.input),/PRODUCTION_LOCK_NOT_RESTORED/);
});
test('native Git publishing and non-Git deploy policy are checked before unlocking',async()=>{
 for(const value of [{gitBuildsStopped:false},{nonGitProductionDeploysAllowed:false}]){const f=fixture();f.set(value);await assert.rejects(uploadWithProductionLock(f.input));assert.deepEqual(f.calls,[]);}
});
test('a changed production before unlock cannot be overwritten',async()=>{
 const f=fixture();f.set({id:'someone-else'});await assert.rejects(uploadWithProductionLock(f.input),/PRODUCTION_CHANGED/);assert.deepEqual(f.calls,[]);
});
