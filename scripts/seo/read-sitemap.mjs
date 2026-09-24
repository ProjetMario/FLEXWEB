// Same-origin recursion for both emitted files and read-only live audits.
export async function readSitemap(rootUrl,read){
 const visited=new Set(),urls=[];const origin=new URL(rootUrl).origin;
 async function visit(url){
  if(new URL(url).origin!==origin)throw new Error('Foreign sitemap');
  if(visited.has(url))throw new Error('Sitemap cycle');visited.add(url);
  if(visited.size>100)throw new Error('Too many sitemap segments');
  const xml=await read(url),locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
  if(xml.includes('<sitemapindex'))for(const child of locs)await visit(child);
  else if(xml.includes('<urlset'))urls.push(...locs);
  else throw new Error('Invalid sitemap root');
 }
 await visit(rootUrl);return urls;
}
