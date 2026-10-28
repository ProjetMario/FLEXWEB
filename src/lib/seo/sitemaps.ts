import {corePages} from './core-pages';
import {nationalUrls} from './national';
import {territorialUrls} from './territorial-publication.mjs';
import {chunks} from './xml.mjs';
import {candidates,expansionEnabled} from '../seo-expansion/fr-ch.mjs';
let cached:Promise<{name:string;items:{url:string;lastmod?:string;family:string}[]}[]>|undefined;
export function sitemapGroups(){return cached??=(async()=>{
 const pages=[...await corePages(),...nationalUrls(),...territorialUrls(),...(expansionEnabled()?candidates().map(({path}:{path:string})=>({url:path,family:'projets-sites'})):[])];
 if(new Set(pages.map(p=>p.url)).size!==pages.length)throw new Error('Duplicate sitemap route');
 return [...new Set(pages.map(p=>p.family))].sort().flatMap(family=>chunks(pages.filter(p=>p.family===family)).map((items,index)=>({name:`${family}-${index+1}`,items})));
})();}
