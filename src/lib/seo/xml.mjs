export const origin='https://flex-web.fr';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function chunks(items,size=2000){if(!Number.isInteger(size)||size<1)throw new Error('Invalid chunk size');return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
export const sitemapIndex=paths=>`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<sitemap><loc>${origin}${escape(p)}</loc></sitemap>`).join('')}</sitemapindex>`;
export const urlset=items=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.map(p=>`<url><loc>${origin}${escape(p.url)}</loc>${p.lastmod?`<lastmod>${escape(p.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`;
