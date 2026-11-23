import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {archiveId,cacheDir,parallel} from '../netlify.mjs';
import {readHTTP,inspectHTML,sampleRows,assetReferences} from './inspect.mjs';

export async function scanResources(id,rows,selected) {
  const origin='https://'+id+'--flex-webb.netlify.app';
  const assets=new Set(),links=new Set(),bitmapExtensions=/\.(?:css|m?js)$/i;
  await parallel(selected,7,async row=>{
    const response=await readHTTP(origin,row.path);
    assert.match(response.type,/text\/html/i,row.path);
    const info=inspectHTML(response.bytes,row.path);
    for(const path of info.assets)assets.add(path);
    for(const path of info.links)links.add(path);
  });
  let queue=[...assets];
  while(queue.length){
    const upcoming=new Set();
    await parallel(queue,7,async path=>{
      const response=await readHTTP(origin,path);
      assert.ok(response.bytes.length,path);
      assert.ok(!/^text\/html/i.test(response.type),'Page HTML renvoyée pour la ressource '+path);
      if(bitmapExtensions.test(path))for(const ref of assetReferences(response.bytes,path)){
        if(!assets.has(ref)){assets.add(ref);upcoming.add(ref);}
      }
    });
    queue=[...upcoming];
  }
  const indexed=new Set(rows.map(row=>row.path));
  const linksOutsideSitemap=[...links].filter(p=>!indexed.has(p)).sort();
  for (const path of linksOutsideSitemap) {
    assert.match(path,/^\/(?:demarrer|projets-sites|demo)(?:\/|$)/,'Lien public hors inventaire à qualifier : '+path);
    const response=await readHTTP(origin,path);
    assert.match(response.type,/text\/html/i,path);
  }
  return {id,sampledHTML:selected.length,internalLinks:links.size,assets:[...assets].sort(),linksOutsideSitemap};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const rows=(await readFile(join(cacheDir,'inventory.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
  const id=process.argv[2]||archiveId;
  const selected=sampleRows(rows).filter(row=> id!==archiveId||!['/realisations/footnation/','/en/case-studies/footnation/','/applications/belgique-francophone/','/applications/suisse-romande/'].includes(row.path));
  const report=await scanResources(id,rows,selected);
  const dir=join(cacheDir,'audit');await mkdir(dir,{recursive:true});
  await writeFile(join(dir,id===archiveId?'required-assets.json':id+'-assets.json'),JSON.stringify(report,null,2)+'\n');
  console.log(report.sampledHTML+' pages, '+report.assets.length+' ressources, '+report.linksOutsideSitemap.length+' liens hors sitemap.');
}
