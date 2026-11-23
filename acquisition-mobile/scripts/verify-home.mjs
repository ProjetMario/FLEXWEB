import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {baseUrl,cache} from './baseline.mjs';

const preview=process.argv[2];
assert.ok(preview,'Indiquer l’URL de l’aperçu.');
const dir=join(cache,'home');
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for (const width of [390,1440]) for (const route of ['/','/en/']) {
    const label=(route==='/en/'?'en':'fr')+'-'+width;
    const pictures=[];
    for (const [name,site] of [['avant',baseUrl],['apercu',preview]]) {
      const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',deviceScaleFactor:1});
      const page=await context.newPage();
      await page.route(/googletagmanager|google-analytics/,route=>route.abort());
      await page.goto(new URL(route,site).href,{waitUntil:'networkidle'});
      const heading=page.locator('h1');
      await heading.waitFor();
      assert.ok(await heading.isVisible(),label);
      await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.querySelectorAll('img')].filter(img=>img.loading!=='lazy').map(img=>img.decode().catch(()=>{})));});
      const png=await page.screenshot({animations:'disabled',caret:'hide'});
      await writeFile(join(dir,label+'-'+name+'.png'),png);
      pictures.push(png.toString('base64'));
      await context.close();
    }
    const compare=await browser.newPage();
    const diff=await compare.evaluate(async images => {
      const pixels=[];
      let count;
      for (const png of images) {
        const img=new Image();
        img.src='data:image/png;base64,'+png;
        await img.decode();
        const canvas=document.createElement('canvas');
        canvas.width=img.width; canvas.height=img.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        pixels.push(ctx.getImageData(0,0,img.width,img.height).data);
        count=img.width*img.height;
      }
      let changed=0, strong=0;
      for (let i=0;i<pixels[0].length;i+=4) {
        const delta=Math.max(...[0,1,2].map(k=>Math.abs(pixels[0][i+k]-pixels[1][i+k])));
        if (delta) changed++;
        if (delta>48) strong++;
      }
      return {changed,strong,count};
    },pictures);
    await compare.close();
    // Subpixel antialiasing on the tilted phone can vary between identical renders.
    assert.ok(diff.changed/diff.count<0.0005 && diff.strong/diff.count<0.00005, label+' '+JSON.stringify(diff));
    console.log(label+' : '+diff.changed+'/'+diff.count+' pixels différents, '+diff.strong+' à fort contraste');
  }
} finally {await browser.close();}
