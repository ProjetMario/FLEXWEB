#!/usr/bin/env node
/** Publish the new presentation without replacing the legacy backend.
 * Main page: Netlify post-processing snippet. Form: permanent Netlify static receiver.
 * All credentials remain in the GitHub deployment environment.
 */
import {NetlifyAPI} from '@netlify/api';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const SITE_ID='5215a04e-7872-45e3-b354-fc8f994d2219';
const FORM_SITE_ID='7f29049b-1c35-44a6-9d01-1881e7f2a42b';
const HOST='nova-habitat-demo-flexweb.netlify.app';
const LIVE='https://'+HOST;
const FORM_HOST='https://nova-habitat-demandes-5215a04e.netlify.app';
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
 return `(function(){'use strict';if(location.hostname!==${JSON.stringify(HOST)}||!['/','/index.html'].includes(location.pathname))return;if(/(?:^#|&)(?:invite_token|recovery_token|confirmation_token|access_token)=/.test(location.hash))return;const p=${safeJSON(payload)};let pending=true;const mask=document.createElement('style');mask.textContent='html[data-nova-pending] body{visibility:hidden}';document.head.append(mask);document.documentElement.setAttribute('data-nova-pending','');const clear=()=>{document.documentElement.removeAttribute('data-nova-pending');mask.remove();pending=false};const timer=setTimeout(clear,4000);function render(){try{const parsed=new DOMParser().parseFromString(p.html,'text/html');for(const img of parsed.querySelectorAll('img')){const path=img.getAttribute('src');if(path&&p.images[path.slice(1)])img.src=p.images[path.slice(1)];}const oldStyles=[...document.querySelectorAll('link[rel="stylesheet"],style#nova-presentation-css')];const sheet=document.createElement('style');sheet.id='nova-presentation-css';sheet.textContent=p.css;document.head.append(sheet);const content=document.createDocumentFragment();for(const child of [...parsed.body.childNodes])content.append(document.importNode(child,true));document.body.replaceChildren(content);for(const link of oldStyles)link.remove();document.title=parsed.title;for(const name of ['description','theme-color']){const source=parsed.querySelector('meta[name="'+name+'"]');if(!source)continue;let target=document.querySelector('meta[name="'+name+'"]');if(!target){target=document.createElement('meta');target.name=name;document.head.append(target)}target.content=source.content;}const code=document.createElement('script');code.textContent=p.js;document.body.append(code);document.documentElement.dataset.novaRelease=p.release;document.documentElement.dataset.novaPresentation='v2';if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target)requestAnimationFrame(()=>target.scrollIntoView());}}catch(error){console.error('Nova Habitat presentation could not be applied');}finally{clearTimeout(timer);clear();}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();})();`;
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
  droneAvailable:[...document.querySelectorAll('#prestation option')].some(o=>/drone/i.test(o.textContent)),
  formAction:document.getElementById('devis-form')?.action,
  nativeSubmit:document.getElementById('devis-form')?.dataset.nativeSubmit
 }));
 check(result.headings===1&&result.sections,'Invalid page structure');
 check(result.logo==='/logo-nova-habitat.jpg'&&result.logoWidth===1280,'Logo rendering changed');
 check(result.phoneLinks&&result.images,'Missing image or incorrect contact link');
 check(!result.overflow&&!result.previewNoticeVisible&&!result.droneAvailable,'Invalid mobile or production state');
 check(result.formAction===FORM_HOST+'/merci-nova'&&result.nativeSubmit==='true','Quote receiver not connected');
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
 const endpoint=JSON.parse(await readFile('.work/form-endpoint.json','utf8'));
 check(endpoint.published&&endpoint.siteId===FORM_SITE_ID&&endpoint.url===FORM_HOST,'Unverified form receiver');
 const receiving=await api.getSite({site_id:FORM_SITE_ID});
 check(receiving.account_id===site.account_id,'Form receiver account does not match');
 const form=(await api.listSiteForms({site_id:FORM_SITE_ID})).find(f=>f.name===FORM);
 check(form,'Permanent quote form not registered; enable Netlify Forms and redeploy the receiver');
 report.formId=form.id;report.formSiteId=FORM_SITE_ID;report.formAction=endpoint.action;
 const manifest=JSON.parse(await readFile('assets.json','utf8'));
 check(hash(await bytes(LIVE+'/logo-nova-habitat.jpg'))===manifest.logo_sha256,'Original logo mismatch');
 const snippets=await api.listSiteSnippets({site_id:SITE_ID});
 const previous=snippets.find(s=>s.title===TITLE);
 let priorImages={};
 if(previous?.general){try{const json=previous.general.match(/const p=(.*?);let pending=true;/s)?.[1];if(json)priorImages=JSON.parse(json).images||{};}catch{}}
 let html=await readFile('site/index.html','utf8');
 const css=await readFile('site/nova-v2.css','utf8');
 const js=await readFile('site/nova-v2.js','utf8');
 check(js.includes("form.dataset.nativeSubmit === 'true'"),'Native form submission behavior is missing');
 html=html.replace('action="/merci-nova"','action="'+FORM_HOST+'/merci-nova" data-native-submit="true"');
 html=html.replace(/<link rel="stylesheet" href="\/nova-v2\.css">/,'').replace(/<script src="\/nova-v2\.js" defer><\/script>/,'');
 const images={};report.illustrationBytes={};
 for(const image of manifest.images){
  let data;
  try{data=await bytes(image.url);}
  catch{if(priorImages[image.file])data=Buffer.from(priorImages[image.file].split(',')[1],'base64');else data=await bytes(FORM_HOST+'/'+image.file);}
  check(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP','Invalid illustration');
  images[image.file]='data:image/webp;base64,'+data.toString('base64');report.illustrationBytes[image.file]=data.length;
 }
 const script=runtime({html,css,js,release,images});
 const general='<script id="nova-habitat-presentation" data-release="'+release+'">'+script+'</script>';
 check(Buffer.byteLength(general)<2*1024*1024,'Presentation bundle too large');report.presentationBytes=Buffer.byteLength(general);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(LIVE+'/?nova_validation='+release,{waitUntil:'networkidle'});
 await page.addScriptTag({content:script});await validate(page,'desktopValidation');
 await page.setViewportSize({width:390,height:844});await validate(page,'mobileValidation');
 await page.locator('.menu-toggle').click();check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='true','Menu did not open');
 await page.locator('#navigation a[href="#toiture"]').click();check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='false','Menu did not close');
 await page.locator('#toiture a[data-service="toiture"]').click();check(await page.locator('#prestation').inputValue()==='toiture','Quote preselection failed');
 report.menuAndQuoteSelectionVerified=true;
 const hooks=await api.listHooksBySiteId({site_id:FORM_SITE_ID});
 const isTarget=h=>h.type==='email'&&h.event==='submission_created'&&h.data?.email==='73novahabitat@gmail.com'&&!h.disabled;
 if(!hooks.some(isTarget))await api.createHookBySiteId({site_id:FORM_SITE_ID,body:{type:'email',event:'submission_created',data:{email:'73novahabitat@gmail.com'}}});
 report.emailNotificationConfigured=(await api.listHooksBySiteId({site_id:FORM_SITE_ID})).some(isTarget);
 check(report.emailNotificationConfigured,'Email notification configuration not confirmed');
 const marker='NOVA-HABITAT-DEPLOYMENT-CHECK-V2';
 let technical=(await api.listFormSubmissions({form_id:form.id})).find(s=>s.data?.nom===marker);
 if(!technical){
  await page.locator('#nom').fill(marker);
  await page.locator('#telephone').fill('0784971152');
  await page.locator('#email').fill('73novahabitat@gmail.com');
  await page.locator('#commune').fill('Chambéry');
  await page.locator('#prestation').selectOption('curage');
  await page.locator('#message').fill('Test technique de mise en ligne du formulaire Nova Habitat. Cette entrée sert uniquement à vérifier la réception des demandes. Aucun devis ni rappel client ne sont demandés.');
  await page.locator('input[name="subject"]').evaluate(el=>el.value='TEST TECHNIQUE NOVA HABITAT — aucun devis demandé');
  const navigation=page.waitForNavigation({waitUntil:'domcontentloaded'});
  await page.locator('.submit-button').click();
  const response=await navigation;report.testPostStatus=response?.status();
  check(response?.ok(),'The real quotation POST failed');
  check(page.url().startsWith(FORM_HOST+'/merci-nova'),'Unexpected quote confirmation URL');
  check(await page.locator('h1').textContent().then(t=>t.includes('Merci pour')),'Confirmation message missing');
  for(let attempt=0;attempt<10;attempt++){
   await pause(1800);
   technical=(await api.listFormSubmissions({form_id:form.id})).find(s=>s.data?.nom===marker);
   if(technical)break;
  }
 }
 check(Boolean(technical),'The technical submission was not found in verified Netlify submissions');
 report.formSubmissionVerified=true;report.technicalSubmissionId=technical.id;
 check((await api.getSite({site_id:SITE_ID})).published_deploy.id===oldId,'Legacy deployment changed during validation');
 const body={title:TITLE,general,general_position:'head',goal:'',goal_position:'footer'};
 if(previous)await api.updateSiteSnippet({site_id:SITE_ID,snippet_id:String(previous.id),body});else await api.createSiteSnippet({site_id:SITE_ID,body});
 const stored=(await api.listSiteSnippets({site_id:SITE_ID})).find(s=>s.title===TITLE);
 check(stored&&stored.general===general,'Presentation configuration was not confirmed');report.snippetId=stored.id;
 await page.goto(LIVE+'/?nova_release='+release,{waitUntil:'networkidle'});await validate(page,'liveMobileValidation');
 check(report.liveMobileValidation.release===release,'Unexpected live revision');
 await page.screenshot({path:'.work/nova-live-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await validate(page,'liveDesktopValidation');
 await page.screenshot({path:'.work/nova-live-desktop.png',fullPage:true});
 const admin=await page.goto(LIVE+'/admin/?nova_verify='+release,{waitUntil:'domcontentloaded'});
 check(admin.ok(),'Admin no longer served');check(!await page.evaluate(()=>Boolean(document.documentElement.dataset.novaPresentation)),'Admin presentation changed');report.adminExcluded=true;
 check((await api.getSite({site_id:SITE_ID})).published_deploy.id===oldId,'Legacy deployment was replaced');
 const unchanged=await api.getDeploy({deploy_id:oldId});
 check(JSON.stringify(unchanged.available_functions)===JSON.stringify(old.available_functions),'Legacy functions changed');report.preservedFunctions=unchanged.available_functions.map(f=>f.n);
 check(hash(await bytes(LIVE+'/logo-nova-habitat.jpg'))===manifest.logo_sha256,'Logo changed');report.logoUnchanged=true;report.published=true;
 report.note='The homepage is updated through Netlify post-processing, with a real, verified native form submission to the dedicated permanent Netlify receiver. The six historical functions and admin remain unchanged. Receipt of the email in the recipient inbox is not independently verified.';
}catch(error){report.error=String(error.message);if(error.status)report.http=error.status;process.exitCode=1;}
finally{if(browser)await browser.close();await writeFile('.work/presentation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
