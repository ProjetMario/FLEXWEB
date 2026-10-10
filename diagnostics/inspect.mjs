import {NetlifyAPI, methods} from '@netlify/api';
import {mkdir, writeFile} from 'node:fs/promises';
const site_id='5215a04e-7872-45e3-b354-fc8f994d2219';
const api=new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);
const safeKeys=new Set(['id','name','sha','digest','n','d','r','im','rg','path','branch','log_type','provider','runtime','runtime_version','invocation_mode','code_sha','function_id','deploy_id','functions_region']);
function outline(value,depth=0){
 if(depth>5)return '[nested]';
 if(Array.isArray(value))return value.slice(0,40).map(item=>outline(item,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/(token|secret|password|environment|headers|credential)/i.test(key)).map(([key,v])=>[key,safeKeys.has(key)?v:(typeof v==='object'?outline(v,depth+1):typeof v)]));
 return typeof value;
}
const report={site_id,published:false};
try {
 const site=await api.getSite({site_id});
 report.siteKeys=Object.keys(site).filter(key=>!/(token|secret|password|environment|headers|credential)/i.test(key));
 report.buildSettingKeys=Object.keys(site.build_settings||{});
 report.methodNames=methods.filter(m=>/function|download|file|deploy/i.test(m.operationId)).map(m=>m.operationId);
 report.functionSearch=outline(await api.searchSiteFunctions({site_id}));
 const deploy=await api.getDeploy({deploy_id:site.published_deploy.id});
 report.functionMetadata=(deploy.available_functions||[]).map(f=>Object.fromEntries(Object.entries(f).filter(([key])=>safeKeys.has(key))));
 report.originalDeploy=deploy.id;
 report.runtimeRegion=deploy.functions_region;
 report.regionOverrides=deploy.functions_region_overrides;
} catch(e){ report.error=e.message; report.http=e.status; }
await mkdir('.work',{recursive:true});
await writeFile('.work/function-metadata.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
