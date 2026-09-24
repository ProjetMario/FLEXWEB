import {isPublishable} from './editorial.mjs';
import {readFileSync} from 'node:fs';
import path from 'node:path';
// Build-time data, intentionally not a Vite JSON import (large corpora inflate bundles).
const raw=JSON.parse(readFileSync(path.resolve('src/data/national/articles.json'),'utf8')) as Array<{axis:Axis;slug:string;title:string;description:string;status:string;reviewedAt:string}>;
export const axes = ['sites', 'automatisation'] as const;
export type Axis = typeof axes[number];
export const axisLabels: Record<Axis,string> = {sites:'Sites internet & visibilité',automatisation:'Automatisation & IA'};
export const articles = raw.filter(isPublishable);
export const articlePath = (a: {axis:string;slug:string}) => `/ressources/${a.axis}/${a.slug}/`;
export const bySlug = new Map(articles.map(a => [a.slug,a]));
export const pageSize = 12;
export const hubPath = (axis:Axis,page=1) => `/ressources/${axis}/${page>1?`page/${page}/`:''}`;
export function hubPages() {
 return axes.flatMap(axis => {
  const items=articles.filter(a=>a.axis===axis);
  return Array.from({length:Math.max(1,Math.ceil(items.length/pageSize))},(_,index)=>({axis,page:index+1,total:Math.max(1,Math.ceil(items.length/pageSize)),items:items.slice(index*pageSize,(index+1)*pageSize)}));
 });
}
export const nationalUrls = () => [
 {url:'/ressources/',lastmod:articles.map(a=>a.reviewedAt).sort().at(-1),family:'sites'},
 ...hubPages().map(p=>({url:hubPath(p.axis,p.page),lastmod:articles.filter(a=>a.axis===p.axis).map(a=>a.reviewedAt).sort().at(-1),family:p.axis})),
 ...articles.map(a=>({url:articlePath(a),lastmod:a.reviewedAt,family:a.axis})),
];
