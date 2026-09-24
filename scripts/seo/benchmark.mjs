/** Private synthetic Astro benchmark. Never deploy this temporary directory. */
import {mkdtemp,cp,symlink,readFile,writeFile,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const count=Number(process.argv[2]||20000);if(!Number.isInteger(count)||count<20||count>20000)throw new Error('Use 20–20000 synthetic records');
const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'flexweb-private-scale-'));
await Promise.all(['src','public'].map(name=>cp(path.join(root,name),path.join(dir,name),{recursive:true})));
await cp('apps/saas-platform/lib/automation/public-quotes.json',path.join(dir,'apps/saas-platform/lib/automation/public-quotes.json'),{recursive:false});
for(const file of ['astro.config.mjs','package.json','tsconfig.json'])await cp(file,path.join(dir,file));
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
const seeds=JSON.parse(await readFile('src/data/national/articles.json','utf8'));
const synthetic=Array.from({length:count},(_,i)=>({...seeds[i%seeds.length],slug:`synthetic-private-${i}`,intent:`synthetic-private-${i}`,title:`SYNTHETIC LOAD TEST ${i}`,related:[`synthetic-private-${(i+1)%count}`]}));
await writeFile(path.join(dir,'src/data/national/articles.json'),JSON.stringify(synthetic));
const started=Date.now();const child=spawn('/usr/bin/time',['-l',process.execPath,path.join(root,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:dir,env:{...process.env,CONTEXT:'',NETLIFY:'',NODE_OPTIONS:'--max-old-space-size=4096'},stdio:['ignore','pipe','pipe']});
let tail='';child.stdout.on('data',d=>{tail=(tail+d.toString()).slice(-4000)});child.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-4000)});
const code=await new Promise(r=>child.on('close',r));
let bytes=0,files=0,html=0;async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())await walk(f);else {bytes+=(await stat(f)).size;files++;if(f.endsWith('.html'))html++;}}}
if(code===0)await walk(path.join(dir,'dist'));
const report={type:'synthetic-private-astro-build',node:process.version,peakResidentBytes:Number(tail.match(/(\d+)\s+maximum resident set size/)?.[1]||0),syntheticArticles:count,exitCode:code,elapsedSeconds:(Date.now()-started)/1000,bytes,files,html,contentValidated:false,productionDeployAllowed:false,logTail:tail};
await mkdir('outputs/seo-national-20260924',{recursive:true});await writeFile('outputs/seo-national-20260924/benchmark.json',JSON.stringify(report,null,2)+'\n');
// The load corpus is intentionally never retained as deployable content.
await rm(dir,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));if(code!==0)process.exitCode=1;
