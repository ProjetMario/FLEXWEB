import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {chromium} from 'playwright';

const origin = new URL(process.argv[2]).origin;
const reference = 'https://6b04a05bc3647bd53a28174f--flex-webb.netlify.app';
const axe = process.argv[3] ? await readFile(process.argv[3],'utf8') : null;
const out = join(fileURLToPath(new URL('../../.release/redesign/qa/offers/',import.meta.url)), new URL(origin).host.replaceAll(':','-'));
await mkdir(out,{recursive:true});
const pages = ['/creation-application-mobile/','/automatisation-ia/','/creation-site-internet/'];
const startingPrices = ['1 990 € TTC', 'sur devis', '299 € TTC'];
const rootSite = '/demarrer/?service=site';
const forms = [
  [pages[0],'/demarrer/application/','applicationTier','essentielle','À partir de 1 990 € TTC'],
  [pages[1],'/demarrer/?service=automation','planId','achat','Sur devis'],
  [pages[2],rootSite,'planId','essentielle','299 € TTC'],
  ...[['essentielle','299 € TTC'],['business','590 € TTC'],['premium','990 € TTC']].map(([slug,price])=>[pages[2],rootSite+'&offre='+slug,'planId',slug,price]),
];
const report = {origin,reference,at:new Date().toISOString(),axe:Boolean(axe),before:{},after:{},layouts:[],forms:[],links:[],externalLinks:[],errors:[]};
const browser = await chromium.launch();
const links = new Set();
const normalize = text => text.replace(/\s+/g,' ').trim();

async function makeContext(url,width) {
  const context = await browser.newContext({viewport:{width,height:width<=390?844:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
  await context.route('**/*',route=>{
    const request=route.request(),target=new URL(request.url());
    if(!['GET','HEAD'].includes(request.method()) || target.origin!==url || target.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  return context;
}
async function visit(page,url) {
  assert.equal((await page.goto(url,{waitUntil:'load'})).status(),200,url);
  await page.evaluate(()=>document.fonts.ready);
}
async function metrics(page) {
  return page.locator('main').first().evaluate(main=>{
    const clean=s=>s.replace(/\s+/g,' ').trim();
    const words=s=>(clean(s).match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)||[]).length;
    const clone=main.cloneNode(true);
    clone.querySelectorAll('script,style,template,noscript').forEach(el=>el.remove());
    const it=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT), parts=[];
    while(it.nextNode()) parts.push(it.currentNode.textContent);
    return {totalWords:words(parts.join(' ')),visibleWords:words(main.innerText),quoteLinks:main.querySelectorAll('a[href^="/demarrer/"]').length,h1:main.querySelectorAll('h1').length,title:clean(main.querySelector('h1')?.textContent||'')};
  });
}
async function inspect(page,path,width) {
  await visit(page,origin+path);
  const current=await metrics(page);
  assert.equal(current.h1,1,path);
  assert.ok(await page.locator('h1').isVisible());
  if (width===390) report.after[path]=current;
  const startingPrice=normalize(await page.locator('main .offer-price').innerText()).toLowerCase();
  assert.ok(startingPrice.includes(startingPrices[pages.indexOf(path)].toLowerCase()),'Prix ou mode de chiffrage du hero');
  const hero=page.locator('main.offer-page .offer-hero');
  assert.equal(await hero.locator('a.offer-primary[href^="/demarrer/"]').count(),1,'CTA principal');
  assert.equal(await hero.locator('.offer-actions a').count(),2,'Deux actions dans le hero');
  const viewport=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(viewport<=width+1,'Débordement du document '+viewport+' à '+width);
  if(width===320 && path===pages[0]) {
    const menu=page.locator('header details').first();
    await menu.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.ok(await menu.evaluate(el=>el.open && document.documentElement.scrollWidth<=window.innerWidth+1),'Menu mobile ouvert');
    assert.ok(await menu.locator('nav a').first().isVisible());
    await page.keyboard.press('Space');
    assert.ok(await menu.evaluate(el=>!el.open));
  }
  for(const image of await hero.locator('img').all()) {
    await image.evaluate(el=>el.decode());
    assert.ok(await image.evaluate(el=>el.naturalWidth>0 && el.alt.trim().length>0),'Image du projet');
  }
  const faq=page.locator('main .offer-faq details');
  const shown=await faq.evaluateAll(els=>els.map(el=>[el.querySelector('summary').textContent,el.querySelector('p').textContent]));
  const schema=await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(el=>[JSON.parse(el.textContent)].flat()).flatMap(n=>n['@graph']||[n]);
    return nodes.find(n=>n['@type']==='FAQPage')?.mainEntity.map(q=>[q.name,q.acceptedAnswer.text]);
  });
  assert.ok(shown.length>0 && schema,'FAQ manquante');
  assert.deepEqual(shown.map(pair=>pair.map(normalize)),schema.map(pair=>pair.map(normalize)));
  for(const selector of await faq.locator('summary').all()) {
    await selector.focus(); await page.keyboard.press('Enter');
    assert.ok(await selector.evaluate(s=>s.parentElement.open),'FAQ au clavier');
    await page.keyboard.press('Space');
    assert.ok(await selector.evaluate(s=>!s.parentElement.open));
  }
  if(width===390) {
    const hrefs=await page.locator('main a[href]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
    for(const href of hrefs) {
      if(/^(tel:|mailto:)/.test(href)) continue;
      const url=new URL(href,origin+path);
      if(url.origin===origin) links.add(url.pathname+url.search+url.hash);
      else if(url.protocol==='https:' && !report.externalLinks.includes(url.href)) report.externalLinks.push(url.href);
    }
  }
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});
  await page.screenshot({path:join(out,path.split('/')[1]+'-'+width+'.png'),animations:'disabled'});
  const violations=[];
  if(axe) {
    await page.addScriptTag({content:axe});
    violations.push(...await page.evaluate(async()=>{
      const result=[];
      for(const state of ['initial','details-open']) {
        if(state==='details-open') document.querySelectorAll('main details').forEach(el=>{el.open=true;});
        const audit=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
        result.push(...audit.violations.map(v=>({state,id:v.id,targets:v.nodes.map(n=>n.target)})));
      }
      return result;
    }));
  }
  report.layouts.push({path,width,faq:shown.length,violations});
  assert.deepEqual(violations,[],path+' '+width);
}
async function checkForm(page,[source,href,field,value,price]) {
  await visit(page,origin+source);
  const link=page.locator('main a[href="'+href+'"]').first();
  await link.focus(); await page.keyboard.press('Enter');
  await page.waitForURL(origin+href);
  const select=page.locator('astro-island:not([ssr]) form select[name="'+field+'"]');
  await select.waitFor();
  assert.equal(await select.inputValue(),value,href);
  assert.equal(normalize(await page.locator('.flow-price').innerText()),price,href);
  report.forms.push({source,href,value,price,submitted:false});
}
async function checkLink(href) {
  const url=new URL(href,origin);
  const res=await fetch(url,{method:url.hash?'GET':'HEAD',redirect:'manual',signal:AbortSignal.timeout(30000)});
  assert.equal(res.status,200,href);
  if(url.hash) {
    const id=decodeURIComponent(url.hash.slice(1));
    const hasID=n=>n.attrs?.some(a=>a.name==='id'&&a.value===id) || (n.childNodes||[]).some(hasID);
    assert.ok(hasID(parse(await res.text())),'Ancre manquante '+href);
  }
  report.links.push(href);
}
try {
  const old=await makeContext(reference,390), baseline=await old.newPage();
  for(const path of pages) {await visit(baseline,reference+path);report.before[path]=await metrics(baseline);}
  await old.close();
  for(const width of [320,390,768,1440]) {
    const context=await makeContext(origin,width), page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    for(const path of pages) {
      try {await inspect(page,path,width);} catch(e){report.errors.push(path+' '+width+' '+e.message);}
    }
    if(width===390) for(const form of forms) {
      try {await checkForm(page,form);} catch(e){report.errors.push(form[1]+' '+e.message);}
    }
    await context.close();
  }
  for(const href of links) {try {await checkLink(href);} catch(e){report.errors.push(href+' '+e.message);}}
} finally {
  await browser.close();
  report.links.sort();
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({before:report.before,after:report.after,layouts:report.layouts.length,forms:report.forms.length,links:report.links.length,errors:report.errors},null,2));
assert.equal(report.errors.length,0,'Consulter '+join(out,'report.json'));
