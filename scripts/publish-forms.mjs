#!/usr/bin/env node
/** A permanent, separately published form receiver; no private legacy functions are copied. */
import {NetlifyAPI} from '@netlify/api';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const MAIN_ID='5215a04e-7872-45e3-b354-fc8f994d2219';
const MAIN='https://nova-habitat-demo-flexweb.netlify.app';
const NAME='nova-habitat-demandes-5215a04e';
const FORM='nova-habitat-devis-v2';
const api=new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);
const hash=data=>createHash('sha1').update(data).digest('hex');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={published:false,purpose:'Nova Habitat quote reception',mainSite:MAIN};
await mkdir('.work',{recursive:true});
async function download(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});check(r.ok,`Asset HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
try{
 const main=await api.getSite({site_id:MAIN_ID});
 check(main.name==='nova-habitat-demo-flexweb'&&main.account_slug,'Unexpected main project');
 const candidates=await api.listSites({name:NAME,filter:'all',per_page:100});
 let site=candidates.find(s=>s.name===NAME&&s.account_id===main.account_id);
 if(!site){site=await api.createSiteInTeam({account_slug:main.account_slug,body:{name:NAME}});report.created=true;}
 check(site.id&&site.id!==MAIN_ID&&site.account_id===main.account_id,'Unexpected receiving project');
 report.siteId=site.id;report.siteName=site.name;report.url='https://'+NAME+'.netlify.app';
 const complete=await api.getSite({site_id:site.id});
 check(!complete.build_settings?.repo_url,'Receiving project has another deployment source');
 if(complete.published_deploy){const previous=await api.getDeploy({deploy_id:complete.published_deploy.id});check(!(previous.available_functions||[]).length,'Receiving project has an unexpected backend');}
 const files=new Map();
 for(const name of ['index.html','nova-v2.css','nova-v2.js','nova-forms.html','merci-nova.html']){
  let data=await readFile('site/'+name);
  if(name==='merci-nova.html')data=Buffer.from(data.toString('utf8').replaceAll('href="/"','href="'+MAIN+'/"'));
  files.set('/'+name,data);
 }
 const assets=JSON.parse(await readFile('assets.json','utf8'));
 for(const image of assets.images){let data;try{data=await download(image.url)}catch{data=await download(report.url+'/'+image.file)}files.set('/'+image.file,data);}
 for(const name of ['logo-nova-habitat.jpg','favicon.svg','nova-habitat.vcf'])files.set('/'+name,await download(MAIN+'/'+name));
 check(createHash('sha256').update(files.get('/logo-nova-habitat.jpg')).digest('hex')===assets.logo_sha256,'Logo changed');
 files.set('/_headers',Buffer.from('/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'));
 files.set('/_redirects',Buffer.from('/admin/* '+MAIN+'/admin/:splat 302\n'));
 const manifest=Object.fromEntries([...files].map(([path,data])=>[path,hash(data)]));
 const deploy=await api.createSiteDeploy({site_id:site.id,title:'Nova Habitat — formulaire et version vitrine depuis GitHub',body:{files:manifest,draft:false,async:false}});
 report.deployId=deploy.id;
 const byHash=new Map([...files].map(([path,data])=>[hash(data),{path,data}]));
 for(const digest of deploy.required||[]){const file=byHash.get(digest);check(file,'Missing asset');await api.uploadDeployFile({deploy_id:deploy.id,path:file.path.slice(1),size:file.data.length,body:file.data});}
 let ready;
 for(let attempt=0;attempt<70;attempt++){ready=await api.getDeploy({deploy_id:deploy.id});if(['ready','error','rejected'].includes(ready.state))break;await pause(1500);}
 check(ready.state==='ready','Receiving deployment is not ready');
 const form=(await api.listSiteForms({site_id:site.id})).find(f=>f.name===FORM);
 report.formDetected=Boolean(form);if(form)report.formId=form.id;
 report.published=true;report.action=report.url+'/merci-nova';
 report.mainUnchanged=(await api.getSite({site_id:MAIN_ID})).published_deploy.id===main.published_deploy.id;
 check(report.mainUnchanged,'Historical deployment changed');
 // A browser-native cross-origin POST needs no CORS workaround and shows this permanent confirmation page.
 await writeFile('.work/form-endpoint.json',JSON.stringify(report,null,2));
}catch(error){report.error=String(error.message);if(error.status)report.http=error.status;process.exitCode=1;}
await writeFile('.work/form-service-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
