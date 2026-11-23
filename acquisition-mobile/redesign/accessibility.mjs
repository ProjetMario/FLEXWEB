import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Pass an installed copy of axe-core to keep it out of the production bundle.
const origin = new URL(process.argv[2]).origin;
const axe = await readFile(process.argv[3], 'utf8');
const local = process.argv.includes('--local-overlay');
const build = fileURLToPath(new URL('../.release/redesign/', import.meta.url));
const out = join(build, 'qa', local ? 'local' : new URL(origin).hostname);
await mkdir(out, {recursive:true});
const routes = ['/', '/en/', '/creation-application-mobile/', '/pricing/', '/demarrer/application/', '/de/anwendungen/ios/', '/it/applicazioni/ios/', '/entrepreneurs/metiers/electricien/'];
const report = [];
const browser = await chromium.launch();
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce', serviceWorkers:'block'});
    await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
    await context.route('**/*', async route=>{
      const request = route.request(), url = new URL(request.url());
      if (!['GET','HEAD'].includes(request.method()) || url.origin !== origin) return route.abort();
      if (local) {
        const parts = url.pathname.slice(1).toLowerCase();
        const rel = parts === '' || parts.endsWith('/') ? parts + 'index.html' : parts;
        for (const source of ['home','shared']) {
          let bytes;
          try { bytes = await readFile(resolve(build,source,rel)); } catch(e) { if (e.code === 'ENOENT') continue; throw e; }
          const type = {'.html':'text/html','.css':'text/css','.webp':'image/webp','.js':'application/javascript'}[extname(rel)];
          return route.fulfill({body:bytes,contentType:type});
        }
      }
      return route.continue();
    });
    const page = await context.newPage();
    for (const path of routes) {
      assert.equal((await page.goto(origin+path)).status(),200,path);
      await page.evaluate(()=>document.fonts.ready);
      await page.addScriptTag({content:axe});
      const checks = await page.evaluate(async () => {
        const {violations} = await window.axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
        return violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,issue:n.failureSummary}))}));
      });
      report.push({path,width,checks});
      console.log(path,width,checks.map(x=>x.id + ' (' + x.nodes.length + ')').join(', ') || 'OK');
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(join(out,'accessibility.json'),JSON.stringify(report,null,2)+'\n');
if (report.some(r=>r.checks.length)) process.exitCode=1;
