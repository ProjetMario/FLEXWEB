#!/usr/bin/env node
/** Presentation-layer publication via Netlify's supported snippet API.
 * The legacy deployment, its six functions, Identity, original logo and admin stay intact.
 * https://docs.netlify.com/build/post-processing/snippet-injection/
 */
import {NetlifyAPI} from '@netlify/api';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const SITE_ID='5215a04e-7872-45e3-b354-fc8f994d2219';
const HOST='nova-habitat-demo-flexweb.netlify.app';
const LIVE='https://'+HOST;
const FORM='nova-habitat-devis-v2';
const TITLE='Nova Habitat — présentation v2 (GitHub)';
const release=process.env.GITHUB_SHA||'local-validation';
const api=new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={site:LIVE,release,published:false,publicationMode:'Netlify presentation snippet',legacyDeploymentReplaced:false,emailDeliveryVerified:false};
let browser;
await mkdir('.work',{recursive:true});
async function bytes(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});check(r.ok,`Asset HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function runtime(payload){
 return `(function(){'use strict';if(location.hostname!==${JSON.stringify(HOST)}||!['/','/index.html'].includes(location.pathname))return;if(/(?:^#|&)(?:invite_token|recovery_token|confirmation_token|access_token)=/.test(location.hash))return;const p=${safeJSON(payload)};let pending=true;const mask=document.createElement('style');mask.textContent='html[data-nova-pending] body{visibility:hidden}';document.head.append(mask);document.documentElement.setAttribute('data-nova-pending','');const clear=()=>{document.documentElement.removeAttribute('data-nova-pending');mask.remove();pending=false};const timer=setTimeout(clear,4000);function render(){try{const parsed=new DOMParser().parseFromString(p.html,'text/html');const oldStyles=[...document.querySelectorAll('link[rel="stylesheet"],style#nova-presentation-css')];const sheet=document.createElement('style');sheet.id='nova-presentation-css';sheet.textContent=p.css;document.head.append(sheet);const content=document.createDocumentFragment();for(const child of [...parsed.body.childNodes])content.append(document.importNode(child,true));document.body.replaceChildren(content);for(const link of oldStyles)link.remove();document.title=parsed.title;for(const name of ['description','theme-color']){const source=parsed.querySelector('meta[name="'+name+'"]');if(!source)continue;let target=document.querySelector('meta[name="'+name+'"]');if(!target){target=document.createElement('meta');target.name=name;document.head.append(target)}target.content=source.content;}const code=document.createElement('script');code.textContent=p.js;document.body.append(code);document.documentElement.dataset.novaRelease=p.release;document.documentElement.dataset.novaPresentation='v2';if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target)requestAnimationFrame(()=>target.scrollIntoView());}}catch(error){console.error('Nova Habitat presentation could not be applied');}finally{clearTimeout(timer);clear();}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();})();`;
}
async function validate(page,label){
 await page.waitForFunction(()=>document.documentElement.dataset.novaPresentation==='v2',null,{timeout:20000});
 for(const id of ['jardins','curage','toiture'])await page.locator('#'+id+' .comparison-image').scrollIntoViewIfNeeded();
 await page.evaluate(()=>window.scrollTo(0,0));await pause(350);
 const result=await page.evaluate(()=>({
  title:document.title,release:document.documentElement.dataset.novaRelease,
  headings:document.querySelectorAll('h1').length,
  sections:['curage','toiture','jardins','devis'].every(id=>Boolean(document.getElementById(id))),
  logo:document.querySelector('.brand img')?.getAttribute('src'),
  logoWidth:document.querySelector('.brand img')?.naturalWidth,
  phoneLinks:[...document.querySelectorAll('a[href^="tel:"]')].every(a=>a.getAttribute('href')==='tel:+33784971152'),
  images:[...document.querySelectorAll('.comparison-image img')].every(img=>img.complete&&img.naturalWidth>0),
  overflow:document.documentElement.scrollWidth>innerWidth+1,
  previewNoticeVisible:!document.getElementById('preview-notice')?.hidden,
  droneAvailable:[...document.querySelectorAll('#prestation option')].some(o=>/drone/i.test(o.textContent))
 }));
 check(result.headings===1&&result.sections,'Invalid page structure');
 check(result.logo==='/logo-nova-habitat.jpg'&&result.logoWidth===1280,'Logo rendering changed');
 check(result.phoneLinks&&result.images,'Missing image or incorrect contact link');
 check(!result.overflow&&!result.previewNoticeVisible&&!result.droneAvailable,'Invalid mobile or production state');
 report[label]=result;
}
try{
 check(Boolean(process.env.NETLIFY_AUTH_TOKEN),'Missing Netlify access');
 const site=await api.getSite({site_id:SITE_ID});
 check(site.name==='nova-habitat-demo-flexweb','Unexpected site');
 const oldId=site.published_deploy.id;
 const old=await api.getDeploy({deploy_id:oldId});
 check(old.available_functions?.length===6,'Unexpected legacy backend');
 report.legacyDeployId=oldId;
 const manifest=JSON.parse(await readFile('assets.json','utf8'));
 check(hash(await bytes(LIVE+'/logo-nova-habitat.jpg'))===manifest.logo_sha256,'Original logo mismatch');
 const form=(await api.listSiteForms({site_id:SITE_ID})).find(f=>f.name===FORM);
 check(form,'Netlify form not registered');report.formId=form.id;
 const snippets=await api.listSiteSnippets({site_id:SITE_ID});
 const previous=snippets.find(s=>s.title===TITLE);
 let priorImages={};
 if(previous?.general){try{const json=previous.general.match(/const p=(.*?);let pending=true;/s)?.[1];if(json)priorImages=JSON.parse(json).images||{};}catch{}}
 let html=await readFile('site/index.html','utf8');
 const css=await readFile('site/nova-v2.css','utf8');
 const js=(await readFile('site/nova-v2.js','utf8')).replace("fetch('/nova-forms.html'","fetch('/'");
 html=html.replace('action="/merci-nova"','action="/"');
 const images={};
 report.illustrationBytes={};
 for(const image of manifest.images){
  let data;
  try{data=await bytes(image.url);}
  catch(error){check(priorImages[image.file],'Original illustration unavailable');data=Buffer.from(priorImages[image.file].split(',')[1],'base64');}
  check(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP','Invalid illustration');
  images[image.file]='data:image/webp;base64,'+data.toString('base64');
  html=html.replaceAll('/'+image.file,images[image.file]);
  report.illustrationBytes[image.file]=data.length;
 }
 html=html.replace(/<link rel="stylesheet" href="\/nova-v2\.css">/,'').replace(/<script src="\/nova-v2\.js" defer><\/script>/,'');
 const script=runtime({html,css,js,release,images});
 const general='<script id="nova-habitat-presentation" data-release="'+release+'">'+script+'</script>';
 check(Buffer.byteLength(general)<3*1024*1024,'Presentation bundle too large');
 report.presentationBytes=Buffer.byteLength(general);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(LIVE+'/?nova_validation='+release,{waitUntil:'networkidle'});
 await page.addScriptTag({content:script});
 await validate(page,'desktopValidation');
 await page.setViewportSize({width:390,height:844});
 await validate(page,'mobileValidation');
 await page.locator('.menu-toggle').click();
 check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='true','Menu did not open');
 await page.locator('#navigation a[href="#toiture"]').click();
 check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='false','Menu did not close');
 await page.locator('#toiture a[data-service="toiture"]').click();
 check(await page.locator('#prestation').inputValue()==='toiture','Quote preselection failed');
 report.menuAndQuoteSelectionVerified=true;
 check((await api.getSite({site_id:SITE_ID})).published_deploy.id===oldId,'Legacy deployment changed during validation');
 const body={title:TITLE,general,general_position:'head',goal:'',goal_position:'footer'};
 if(previous)await api.updateSiteSnippet({site_id:SITE_ID,snippet_id:String(previous.id),body});
 else await api.createSiteSnippet({site_id:SITE_ID,body});
 // The create endpoint can return an empty success response. Read back instead of relying on it.
 const stored=(await api.listSiteSnippets({site_id:SITE_ID})).find(s=>s.title===TITLE);
 check(stored&&stored.general===general,'Presentation configuration was not confirmed');
 report.snippetId=stored.id;report.presentationConfigured=true;
 await page.goto(LIVE+'/?nova_release='+release,{waitUntil:'networkidle'});
 await validate(page,'liveMobileValidation');
 check(report.liveMobileValidation.release===release,'Unexpected live revision');
 await page.screenshot({path:'.work/nova-live-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await validate(page,'liveDesktopValidation');
 await page.screenshot({path:'.work/nova-live-desktop.png',fullPage:true});
 const adminResponse=await page.goto(LIVE+'/admin/?nova_verify='+release,{waitUntil:'domcontentloaded'});
 check(adminResponse.ok(),'Admin no longer served');
 check(!await page.evaluate(()=>Boolean(document.documentElement.dataset.novaPresentation)),'Admin presentation changed');
 report.adminExcluded=true;
 // One explicitly marked technical submission, never a fictional customer lead.
 const marker='NOVA-HABITAT-DEPLOYMENT-CHECK-V2';
 let submissions=await api.listFormSubmissions({form_id:form.id});
 let technical=submissions.find(s=>s.data?.nom===marker);
 if(!technical){
  const response=await fetch(LIVE+'/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({'form-name':FORM,subject:'TEST TECHNIQUE NOVA HABITAT — aucun devis demandé','bot-field':'',nom:marker,telephone:'0784971152',email:'73novahabitat@gmail.com',commune:'Chambéry',prestation:'curage',message:'Test technique de mise en ligne du formulaire Nova Habitat. Cette entrée sert uniquement à vérifier la réception des demandes. Aucun devis ni rappel client ne sont demandés.'}),signal:AbortSignal.timeout(30000)});
  report.testPostStatus=response.status;
  if(response.ok)for(let attempt=0;attempt<6;attempt++){await pause(1500);submissions=await api.listFormSubmissions({form_id:form.id});technical=submissions.find(s=>s.data?.nom===marker);if(technical)break;}
 }
 report.formSubmissionVerified=Boolean(technical);
 if(technical)report.technicalSubmissionId=technical.id;
 const hooks=await api.listHooksBySiteId({site_id:SITE_ID});
 const isTarget=h=>h.type==='email'&&h.event==='submission_created'&&h.data?.email==='73novahabitat@gmail.com'&&!h.disabled;
 if(!hooks.some(isTarget))await api.createHookBySiteId({site_id:SITE_ID,body:{type:'email',event:'submission_created',data:{email:'73novahabitat@gmail.com'}}});
 report.emailNotificationConfigured=(await api.listHooksBySiteId({site_id:SITE_ID})).some(isTarget);
 check(report.emailNotificationConfigured,'Email notification configuration not confirmed');
 const final=await api.getSite({site_id:SITE_ID});
 check(final.published_deploy.id===oldId,'Legacy deployment was replaced');
 const same=await api.getDeploy({deploy_id:oldId});
 check(JSON.stringify(same.available_functions)===JSON.stringify(old.available_functions),'Legacy functions changed');
 report.preservedFunctions=same.available_functions.map(f=>f.n);
 check(hash(await bytes(LIVE+'/logo-nova-habitat.jpg'))===manifest.logo_sha256,'Logo changed');
 report.logoUnchanged=true;report.published=true;
 report.note='The homepage is published through Netlify post-processing. Its complete source is in GitHub. The historical deployment, six functions and admin remain unchanged. Email receipt in the recipient inbox is not independently verified.';
}catch(error){report.error=String(error.message);if(error.status)report.http=error.status;process.exitCode=1;}
finally{if(browser)await browser.close();await writeFile('.work/presentation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
