import test from 'node:test';import assert from 'node:assert/strict';
import {commandFailureCode} from './command-diagnostic.mjs';
test('snapshot failure reports only a known stage and allowlisted local code',()=>{
 assert.equal(commandFailureCode('/usr/bin/node',['scripts/cms/snapshot.mjs','pull'],{stderr:'CMS_HTTP_429\n'}),'SNAPSHOT_PULL_CMS_HTTP_429');
 assert.equal(commandFailureCode('node',['scripts/cms/snapshot.mjs','apply'],{stderr:'SOURCE_RENDER_CHANGED'}),'SNAPSHOT_APPLY_SOURCE_RENDER_CHANGED');
 for(const stderr of ['Bearer private-token','CMS_PRIVATE_TOKEN','CMS_HTTP_503\nsecret-data','https://private.example/']){
  assert.equal(commandFailureCode('node',['scripts/cms/snapshot.mjs','pull'],{stderr}),'SNAPSHOT_PULL_FAILED');
 }
 assert.equal(commandFailureCode('npx',['netlify-cli'],{stderr:'CMS_HTTP_429'}),'COMMAND_FAILED_NPX');
});
