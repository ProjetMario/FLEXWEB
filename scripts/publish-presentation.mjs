#!/usr/bin/env node
/**
 * Publishes the approved storefront using Netlify's supported snippet API.
 * This is a presentation-layer release, NOT a replacement of the legacy deploy.
 * The six functions, original logo, domains, Identity and admin files stay intact.
 * Documentation: https://docs.netlify.com/build/post-processing/snippet-injection/
 */
import {NetlifyAPI} from '@netlify/api';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const SITE_ID='5215a04e-7872-45e3-b354-fc8f994d2219';
const SITE_NAME='nova-habitat-demo-flexweb';
const LIVE=`https://${SITE_NAME}.netlify.app`;
const FORM_NAME='nova-habitat-devis-v2';
const TITLE='Nova Habitat — présentation v2 (GitHub)';
const release=process.env.GITHUB_SHA||'local-preview';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const sha=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const report={site:LIVE,release,published:false,publicationMode:'Netlify presentation snippet',legacyDeploymentReplaced:false,emailDeliveryVerified:false};
const api=new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN);
await mkdir('.work',{recursive:true});
let browser;
async function getBytes(url){const response=await fetch(url,{signal:AbortSignal.timeout(45000)});check(response.ok,`Asset HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function buildScript(payload){
 return `(function(){'use strict';if(location.hostname!==${JSON.stringify(SITE_NAME+'.netlify.app')}||!['/','/index.html'].includes(location.pathname))return;if(/(?:^#|&)(?:invite_token|recovery_token|confirmation_token|access_token)=/.test(location.hash))return;const p=${safeJSON(payload)};let pending=true;const mask=document.createElement('style');mask.textContent='html[data-nova-pending] body{visibility:hidden}';document.head.append(mask);document.documentElement.setAttribute('data-nova-pending','');const clear=()=>{document.documentElement.removeAttribute('data-nova-pending');mask.remove();pending=false};const timer=setTimeout(clear,4000);function render(){try{const parsed=new DOMParser().parseFromString(p.html,'text/html');const oldStyles=[...document.querySelectorAll('link[rel="stylesheet"]')];const sheet=document.createElement('style');sheet.id='nova-presentation-css';sheet.textContent=p.css;document.head.append(sheet);const content=document.createDocumentFragment();for(const child of [...parsed.body.childNodes])content.append(document.importNode(child,true));document.body.replaceChildren(content);for(const link of oldStyles)link.remove();document.title=parsed.title;for(const name of ['description','theme-color']){const source=parsed.querySelector('meta[name="'+name+'"]');if(!source)continue;let target=document.querySelector('meta[name="'+name+'"]');if(!target){target=document.createElement('meta');target.name=name;document.head.append(target)}target.content=source.content;}const code=document.createElement('script');code.textContent=p.js;document.body.append(code);document.documentElement.dataset.novaRelease=p.release;document.documentElement.dataset.novaPresentation='v2';if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target)requestAnimationFrame(()=>target.scrollIntoView());}}catch(error){console.error('Nova Habitat presentation could not be applied');}finally{clearTimeout(timer);clear();}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();})();`;
}
async function inspectPage(page,label){
 await page.waitForFunction(()=>document.documentElement.dataset.novaPresentation==='v2',{timeout:20000});
 await page.locator('#jardins .comparison-image').scrollIntoViewIfNeeded();
 await page.locator('#curage .comparison-image').scrollIntoViewIfNeeded();
 await page.locator('#toiture .comparison-image').scrollIntoViewIfNeeded();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.waitForTimeout(400);
 const results=await page.evaluate(()=>({
  title:document.title,release:document.documentElement.dataset.novaRelease,
  headings:document.querySelectorAll('h1').length,
  sections:['curage','toiture','jardins','devis'].every(id=>Boolean(document.getElementById(id))),
  logoSrc:document.querySelector('.brand img')?.getAttribute('src'),
  logoWidth:document.querySelector('.brand img')?.naturalWidth,
  phoneLinks:[...document.querySelectorAll('a[href^="tel:"]')].every(a=>a.getAttribute('href')==='tel:+33784971152'),
  images:[...document.querySelectorAll('.comparison-image img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,width:img.naturalWidth})),
  overflow:document.documentElement.scrollWidth>innerWidth+1,
  previewNoticeVisible:!document.getElementById('preview-notice')?.hidden,
  droneAvailable:[...document.querySelectorAll('#prestation option')].some(o=>/drone/i.test(o.textContent))
 }));
 check(results.headings===1&&results.sections,'Invalid page structure');
 check(results.logoSrc==='/logo-nova-habitat.jpg'&&results.logoWidth===1280,'Logo rendering changed');
 check(results.phoneLinks,'Incorrect phone link');
 check(results.images.every(image=>image.loaded),'An illustration did not load');
 check(!results.overflow,'Horizontal mobile overflow');
 check(!results.previewNoticeVisible&&!results.droneAvailable,'Incorrect production settings');
 report[label]=results;
}
try{
 check(Boolean(process.env.NETLIFY_AUTH_TOKEN),'Netlify access is unavailable');
 const site=await api.getSite({site_id:SITE_ID});
 check(site.name===SITE_NAME,'Wrong Netlify project');
 const oldId=site.published_deploy.id;
 const oldDeploy=await api.getDeploy({deploy_id:oldId});
 check((oldDeploy.available_functions||[]).length===6,'Unexpected legacy backend');
 report.legacyDeployId=oldId;
 const manifest=JSON.parse(await readFile('assets.json','utf8'));
 const logo=await getBytes(LIVE+'/logo-nova-habitat.jpg');
 check(sha(logo)===manifest.logo_sha256,'Original logo does not match');
 const forms=await api.listSiteForms({site_id:SITE_ID});
 const form=forms.find(f=>f.name===FORM_NAME);
 check(form,'The quote form must first be registered by the static preview deployment');
 report.formId=form.id;
 let html=await readFile('site/index.html','utf8');
 const css=await readFile('site/nova-v2.css','utf8');
 let js=await readFile('site/nova-v2.js','utf8');
 // The active legacy site is static, so its root is the correct Netlify Forms POST endpoint.
 js=js.replace("fetch('/nova-forms.html'", "fetch('/'");
 html=html.replace('action="/merci-nova"','action="/"');
 report.illustrationBytes={};
 for(const image of manifest.images){
  const bytes=await getBytes(image.url);
  check(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP','Invalid image');
  report.illustrationBytes[image.file]=bytes.length;
  const dataUrl='data:image/webp;base64,'+bytes.toString('base64');
  html=html.replaceAll('/'+image.file,dataUrl);
 }
 // Styles and behavior are bundled, so the new interface has no dependency on expiring preview URLs.
 html=html.replace(/<link rel="stylesheet" href="\/nova-v2\.css">/,'').replace(/<script src="\/nova-v2\.js" defer><\/script>/,'');
 const payload={html,css,js,release};
 const script=buildScript(payload);
 const snippet='<script id="nova-habitat-presentation" data-release="'+release+'">'+script+'</script>';
 check(Buffer.byteLength(snippet)<3*1024*1024,'Presentation bundle exceeds size guard');
 report.presentationBytes=Buffer.byteLength(snippet);
 await writeFile('.work/presentation-bundle.html',snippet);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.goto(LIVE+'/?nova_validation='+release,{waitUntil:'networkidle'});
 // Validate locally in the browser before changing Netlify's live presentation.
 await page.addScriptTag({content:script});
 await inspectPage(page,'desktopValidation');
 await page.screenshot({path:'.work/nova-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await inspectPage(page,'mobileValidation');
 await page.locator('.menu-toggle').click();
 check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='true','Mobile menu did not open');
 await page.locator('#navigation a[href="#toiture"]').click();
 check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='false','Mobile menu did not close');
 await page.locator('#toiture a[data-service="toiture"]').click();
 check(await page.locator('#prestation').inputValue()==='toiture','Quote preselection failed');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'.work/nova-mobile.png',fullPage:true});
 // Test error feedback without sending an actual quotation.
 await page.route(LIVE+'/',async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,body:'Temporary validation failure'});else await route.continue();});
 await page.locator('#nom').fill('Contrôle technique');
 await page.locator('#telephone').fill('0784971152');
 await page.locator('#commune').fill('Chambéry');
 await page.locator('#message').fill('Vérification locale du comportement du formulaire, aucune demande réelle.');
 await page.locator('.submit-button').click();
 await page.waitForFunction(()=>document.getElementById('form-status').dataset.state==='error');
 check(await page.locator('#nom').inputValue()==='Contrôle technique','Form input lost on network error');
 await page.unroute(LIVE+'/');
 report.errorFeedbackValidated=true;
 const fresh=await api.getSite({site_id:SITE_ID});
 check(fresh.published_deploy.id===oldId,'Legacy production changed during validation');
 const snippets=await api.listSiteSnippets({site_id:SITE_ID});
 const existing=snippets.find(s=>s.title===TITLE);
 const body={title:TITLE,general:snippet,general_position:'head',goal:'',goal_position:'footer'};
 if(existing){await api.updateSiteSnippet({site_id:SITE_ID,snippet_id:String(existing.id),body});report.snippetId=existing.id;}
 else {const created=await api.createSiteSnippet({site_id:SITE_ID,body});report.snippetId=created.id;}
 report.presentationConfigured=true;
 const hooks=await api.listHooksBySiteId({site_id:SITE_ID});
 const notification=hooks.find(h=>h.type==='email'&&h.event==='submission_created'&&h.data?.email==='73novahabitat@gmail.com'&&!h.disabled);
 if(!notification)await api.createHookBySiteId({site_id:SITE_ID,body:{type:'email',event:'submission_created',data:{email:'73novahabitat@gmail.com'}}});
 report.emailNotificationConfigured=true;
 await page.goto(LIVE+'/?nova_release='+release,{waitUntil:'networkidle'});
 await inspectPage(page,'liveMobileValidation');
 check(report.liveMobileValidation.release===release,'Live presentation revision does not match');
 await page.screenshot({path:'.work/nova-live-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await inspectPage(page,'liveDesktopValidation');
 await page.screenshot({path:'.work/nova-live-desktop.png',fullPage:true});
 await page.goto(LIVE+'/admin/?nova_verify='+release,{waitUntil:'networkidle'});
 check(!await page.evaluate(()=>Boolean(document.documentElement.dataset.novaPresentation)),'Presentation modified admin page');
 report.adminExcluded=true;
 const finalSite=await api.getSite({site_id:SITE_ID});
 check(finalSite.published_deploy.id===oldId,'Legacy deployment was replaced');
 const finalDeploy=await api.getDeploy({deploy_id:oldId});
 report.preservedFunctions=finalDeploy.available_functions.map(f=>f.n);
 check(JSON.stringify(finalDeploy.available_functions)===JSON.stringify(oldDeploy.available_functions),'Legacy functions changed');
 check(sha(await getBytes(LIVE+'/logo-nova-habitat.jpg'))===manifest.logo_sha256,'Logo changed after publication');
 report.logoUnchanged=true;
 report.published=true;
 report.note='The production presentation is updated through Netlify snippet injection. The legacy deployment and six functions remain unchanged. The complete static storefront is also available in the verified draft.';
}catch(error){report.error=String(error.message);if(error.status)report.http=error.status;process.exitCode=1;}
finally{if(browser)await browser.close();await writeFile('.work/presentation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
