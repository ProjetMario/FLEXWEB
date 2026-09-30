import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createGzip,createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {extractPage,hash,baselineHash,classifyPath,sourceId,SITE} from './content.mjs';
import {extractImages} from './images.mjs';

/** Initial migration: stream every emitted public page, never hold 20k bodies. */
export async function exportBaseline({root=process.cwd(),dist=path.join(root,'dist'),output=path.join(root,'.cms/import.ndjson.gz'),manifestFile=path.join(root,'cms/baseline.json.gz')}={}){
 await mkdir(path.join(root,'.cms'),{recursive:true});await mkdir(path.dirname(manifestFile),{recursive:true});
 try{await readFile(path.join(root,'.cms/snapshot.json'));throw Error('EXPORT_REQUIRES_SOURCE_BUILD_WITHOUT_CMS_SNAPSHOT');}catch(e){if(e.code!=='ENOENT')throw e;}
 const pricingFingerprint=hash(JSON.parse(await readFile(path.join(root,'apps/saas-platform/lib/automation/public-quotes.json'),'utf8')));
 const sourceUpdatedAt=execFileSync('git',['show','-s','--format=%cI','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const territorial=JSON.parse(await readFile(path.join(root,'src/data/national/territorial-drafts.json'),'utf8'));
 const sourceDate=new Date(territorial.retrievedAt).toISOString();
 const entries=[],counts={},paths=new Set();
 const stage=path.join(root,'.cms/import-stage.ndjson.gz');const sink=createGzip({level:1});const stageDone=pipeline(sink,createWriteStream(stage,{mode:0o600}));
 async function record(entry){
  entry.baselineHash=baselineHash(entry);entry.sourcePayloadHash=hash(entry.data);entry.sourceUpdatedAt??=sourceUpdatedAt;
  entries.push({collection:entry.collection,sourceId:entry.sourceId,path:entry.path,baselineHash:entry.baselineHash,...(entry.data.renderHash?{renderHash:entry.data.renderHash}:{})});
  counts[entry.collection]=(counts[entry.collection]??0)+1;
  if(!sink.write(JSON.stringify(entry)+'\n'))await once(sink,'drain');
 }
 async function walk(dir){
  for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const absolute=path.join(dir,item.name);if(item.isDirectory()){await walk(absolute);continue;}
   if(!item.isFile()||item.name!=='index.html')continue;
   const relative=path.relative(dist,path.dirname(absolute)).split(path.sep).join('/');const route=relative?'/'+relative+'/':'/';
   const html=await readFile(absolute,'utf8');
   // Standalone tenant sites/private payment routes are not public CMS content.
   if(!html.includes(`href="${SITE+route}"`)||route.startsWith('/sites/')||route.startsWith('/espace-projet/'))continue;
   const page=extractPage(html,route),collection=classifyPath(route),sid=sourceId(route);
   if(paths.has(route))throw Error('DUPLICATE_EXPORT_ROUTE');paths.add(route);
   const data={renderHash:page.renderHash,images:extractImages(html),additionalSections:[],editorialStatus:collection==='fiches_territoriales'?'catalogue-public':'source-versionnee'};
   if(collection==='fiches_territoriales'){const [axis,code]=sid.split(':');data.communeCode=code;data.axis=axis;}
   await record({collection,sourceId:sid,path:route,title:page.title,seoTitle:page.title,seoDescription:page.description,content:page.content,data});
  }
 }
 await walk(dist);
 for(const commune of [...territorial.communes].sort((a,b)=>a.code.localeCompare(b.code,'en'))){
  await record({collection:'communes',sourceId:commune.code,path:'',title:commune.name,seoTitle:'',seoDescription:'',content:[],sourceUpdatedAt:sourceDate,data:{facts:commune,source:{url:territorial.source,retrievedAt:sourceDate,sha256:territorial.sourceSha256},additionalSections:[]}});
 }
 sink.end();await stageDone;
 entries.sort((a,b)=>(a.collection+':'+a.sourceId).localeCompare(b.collection+':'+b.sourceId,'en'));
 const manifest={schemaVersion:1,pricingFingerprint,entries};manifest.hash=hash(manifest);
 const manifestGzip=createGzip({level:9});const manifestDone=pipeline(manifestGzip,createWriteStream(manifestFile+'.tmp'));
 manifestGzip.end(JSON.stringify(manifest));await manifestDone;await rename(manifestFile+'.tmp',manifestFile);
 const gzip=createGzip({level:6}),done=pipeline(gzip,createWriteStream(output+'.tmp',{mode:0o600}));
 for await(const line of createInterface({input:createReadStream(stage).pipe(createGunzip()),crlfDelay:Infinity})){
  const record=JSON.parse(line);record.baseManifestHash=manifest.hash;
  if(!gzip.write(JSON.stringify(record)+'\n'))await once(gzip,'drain');
 }
 gzip.end();await done;await rename(output+'.tmp',output);
 const {unlink}=await import('node:fs/promises');await unlink(stage);
 const report={schemaVersion:1,manifestHash:manifest.hash,pricingFingerprint,counts,total:entries.length,publicPages:paths.size,output,manifestFile};
 await writeFile(path.join(root,'.cms/export-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))exportBaseline().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
