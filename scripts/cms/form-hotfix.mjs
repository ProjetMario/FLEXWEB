import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { artifactManifest, PUBLIC_SITE_ID, requireRelease, getNetlifyProductionState, requireDeploymentPolicy } from './release-core.mjs';
import { requestNetlify } from './netlify-request.mjs';
import { uploadWithProductionLock } from './production-upload.mjs';
import { verifyAutomationProxy } from './automation-probe.mjs';
const exec = promisify(execFile);
const baselineId = '6af5d7063fd203bbcd5b2d48';
const baselineCommit = 'c2a9eaae945a93d5afa9dd070d8aa825b8270667';
const baselineDigest = '1ef8d96d488c0307a4cc24b53b44f50fa0856d06da5161bf90bd47c3289f47b6';
const markerPath = '.well-known/flexweb-release.json';
const routes = ['demarrer/index.html', 'privacy/index.html'];
const baselineMarker = {schemaVersion:1,snapshotId:'ad2e67b1a3d8cdf3a3622ccccb9bab6dacfc1e1076057c2747bbee525e4e493c',snapshotSha256:'bb776963c9ca620d92c53047210d5f2b838d67d06555a4e9a5aabf98812beeeb',codeCommit:baselineCommit};
const root = process.cwd();
const baselineDir = process.env.HOTFIX_BASELINE_DIR;
const reportPath = path.join(root,'.cms/form-hotfix-report.json');
const api = (method, suffix) => requestNetlify(method,suffix,{token:process.env.NETLIFY_AUTH_TOKEN});

async function remote(origin, pathname) {
  const response = await fetch(origin + pathname,{redirect:'error',signal:AbortSignal.timeout(30000)});
  requireRelease(response.ok,'REMOTE_FILE_UNAVAILABLE');
  return response.text();
}
async function production() {
  const site=await api('GET',`/sites/${PUBLIC_SITE_ID}`);
  const origin=site.published_deploy?.deploy_ssl_url;
  requireRelease(/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(origin),'INVALID_PRODUCTION_ORIGIN');
  return getNetlifyProductionState(site,JSON.parse(await remote(origin,'/'+markerPath)));
}
async function unchangedProduction() {
  const current=await production();
  requireRelease(current.id===baselineId && current.codeCommit===baselineCommit && current.ready,'PRODUCTION_CHANGED');
  requireDeploymentPolicy(current);
  return current;
}
async function writeReport(report) {
  await mkdir(path.dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}

export async function copyAssetClosure(candidateDir, targetDir, entryFiles) {
  const visited=new Set();
  async function visit(relative) {
    if(visited.has(relative)) return;
    requireRelease(!relative.startsWith('/') && !relative.split('/').includes('..'),'UNSAFE_ASSET_PATH');
    visited.add(relative);
    const data=await readFile(path.join(candidateDir,relative));
    await mkdir(path.dirname(path.join(targetDir,relative)),{recursive:true});
    await copyFile(path.join(candidateDir,relative),path.join(targetDir,relative));
    if(!/\.(?:html|js|css)$/.test(relative)) return;
    const source=data.toString('utf8');
    const matches=[...source.matchAll(/["'`]([^"'`\s<>]+)["'`]/g)].map(match=>match[1]);
    for(const match of source.matchAll(/url\(([^)'"\s]+)\)/g)) matches.push(match[1]);
    for(const value of matches) {
      if(!value.startsWith('/_astro/') && !(/\.(?:js|css)$/.test(relative) && value.startsWith('.'))) continue;
      const url=new URL(value,'https://assets.invalid/'+relative);
      if(url.origin!=='https://assets.invalid' || !url.pathname.startsWith('/_astro/')) continue;
      await visit(url.pathname.slice(1));
    }
  }
  for(const entry of entryFiles) await visit(entry);
  return [...visited].sort();
}

async function verify(origin,report) {
  const actual=JSON.parse(await remote(origin,'/'+markerPath));
  requireRelease(actual.codeCommit===report.codeCommit && actual.snapshotSha256===baselineMarker.snapshotSha256,'REMOTE_MARKER_MISMATCH');
  for(const relative of [...routes,...report.assets]) {
    const response=await fetch(origin+'/'+relative,{redirect:'follow',signal:AbortSignal.timeout(30000)});
    requireRelease(response.ok,'PATCH_ASSET_UNAVAILABLE');
    const expected=await readFile(path.join(baselineDir,relative));
    requireRelease(Buffer.from(await response.arrayBuffer()).equals(expected),'PATCH_BYTES_MISMATCH');
  }
  const baselineOrigin=`https://${baselineId}--flex-webb.netlify.app`;
  for(const route of ['/','/pricing/','/contact/','/en/','/espace-projet/','/robots.txt','/sitemap.xml']) {
    requireRelease(await remote(origin,route)===await remote(baselineOrigin,route),'UNRELATED_ROUTE_CHANGED');
  }
  await verifyAutomationProxy(origin);
}

async function deploy(productionDeploy,codeCommit) {
  const args=['--yes','netlify-cli@23.15.1','deploy','--no-build','--dir',baselineDir,'--site',PUBLIC_SITE_ID,'--json','--message',`Form-only conversion fix ${codeCommit}`];
  if(productionDeploy) args.push('--prod');
  const {stdout}=await exec('npx',args,{cwd:root,env:process.env,maxBuffer:8*1024*1024,timeout:10*60*1000});
  const output=JSON.parse(stdout.trim());
  requireRelease(typeof output.deploy_id==='string','DEPLOY_ID_MISSING');
  const record=await api('GET',`/deploys/${output.deploy_id}`);
  requireRelease(record.site_id===PUBLIC_SITE_ID && record.state==='ready','DEPLOY_NOT_READY');
  return {id:record.id,siteId:record.site_id,ready:true,url:record.deploy_ssl_url};
}

async function main() {
  requireRelease(baselineDir && path.isAbsolute(baselineDir),'BASELINE_DIRECTORY_REQUIRED');
  const action=process.argv[2];
  if(action==='baseline') {
    await mkdir(path.join(baselineDir,'.well-known'),{recursive:true});
    await writeFile(path.join(baselineDir,markerPath),JSON.stringify(baselineMarker)+'\n');
    const manifest=await artifactManifest(baselineDir);
    await writeReport({status:'baseline-check',baselineDeployId:baselineId,baselineDigest:manifest.digest,files:manifest.files.length});
    requireRelease(manifest.digest===baselineDigest,'BASELINE_DOES_NOT_MATCH_PUBLISHED_ARTIFACT');
    await writeFile(path.join(root,'.cms/form-hotfix-baseline-manifest.json'),JSON.stringify(manifest));
    console.log(JSON.stringify({baselineVerified:true,files:manifest.files.length,digest:manifest.digest}));
    return;
  }
  if(action==='prepare') {
    const before=JSON.parse(await readFile(path.join(root,'.cms/form-hotfix-baseline-manifest.json'),'utf8'));
    requireRelease((await artifactManifest(baselineDir)).digest===baselineDigest,'BASELINE_CHANGED');
    const codeCommit=(await exec('git',['rev-parse','HEAD'])).stdout.trim();
    const closure=await copyAssetClosure(path.join(root,'dist'),baselineDir,routes);
    const marker={...baselineMarker,codeCommit,scopedPatch:{baseDeployId:baselineId,baseCodeCommit:baselineCommit,paths:['/demarrer/','/privacy/']}};
    await writeFile(path.join(baselineDir,markerPath),JSON.stringify(marker)+'\n');
    const after=await artifactManifest(baselineDir);
    const old=new Map(before.files.map(file=>[file.path,file]));
    const changed=after.files.filter(file=>old.get(file.path)?.sha256!==file.sha256);
    const allowed=new Set([...routes,markerPath,...closure.filter(file=>file.startsWith('_astro/'))]);
    requireRelease(changed.every(file=>allowed.has(file.path)),'UNRELATED_FILE_CHANGED');
    requireRelease(changed.filter(file=>old.has(file.path)).every(file=>routes.includes(file.path)||file.path===markerPath),'EXISTING_SHARED_ASSET_CHANGED');
    requireRelease(changed.length<=30 && after.files.length>=before.files.length,'PATCH_SCOPE_EXCEEDED');
    const report={status:'prepared',codeCommit,baselineDeployId:baselineId,baselineDigest,artifactDigest:after.digest,marker,changed:changed.map(({path,size})=>({path,size})),assets:closure.filter(file=>file.startsWith('_astro/')),unchangedFiles:after.files.length-changed.length};
    await writeReport(report);
    console.log(JSON.stringify(report));
    return;
  }
  requireRelease(action==='publish','INVALID_ACTION');
  let report=JSON.parse(await readFile(reportPath,'utf8'));
  requireRelease(report.status==='prepared' && (await artifactManifest(baselineDir)).digest===report.artifactDigest,'ARTIFACT_CHANGED');
  await unchangedProduction();
  const branch=process.env.GITHUB_REF_NAME;
  requireRelease(branch==='codex/form-only-production-hotfix','UNEXPECTED_SOURCE_BRANCH');
  const source=(await exec('git',['ls-remote','origin',`refs/heads/${branch}`])).stdout.split(/\s+/)[0];
  requireRelease(source===report.codeCommit,'SOURCE_ADVANCED');
  const preview=await deploy(false,report.codeCommit);
  report={...report,status:'preview',preview}; await writeReport(report);
  await verify(preview.url,report);
  await unchangedProduction();
  requireRelease((await artifactManifest(baselineDir)).digest===report.artifactDigest,'ARTIFACT_CHANGED');
  const published=await uploadWithProductionLock({expected:report.marker,expectedProductionId:baselineId,currentProduction:production,
    unlock:id=>api('POST',`/deploys/${id}/unlock`),lock:id=>api('POST',`/deploys/${id}/lock`),upload:()=>deploy(true,report.codeCommit)});
  report={...report,status:'published',published}; await writeReport(report);
  await verify('https://flex-web.fr',report);
  const current=await production();
  requireRelease(current.id===published.id && current.locked,'PRODUCTION_NOT_CONFIRMED_LOCKED');
  report={...report,status:'verified',verifiedAt:new Date().toISOString()}; await writeReport(report);
  console.log(JSON.stringify({status:report.status,deployId:published.id,changed:report.changed,unchangedFiles:report.unchangedFiles}));
}
if(process.argv[1] && path.resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  main().catch(error=>{console.error(/^[A-Z0-9_]+$/.test(error.message)?error.message:'SCOPED_PUBLICATION_FAILED');process.exitCode=1;});
}
