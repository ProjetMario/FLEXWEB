import { sitemapIndex } from '../lib/seo/xml.mjs';
import { sitemapGroups } from '../lib/seo/sitemaps';
export async function GET(){const groups=await sitemapGroups();return new Response(sitemapIndex(groups.map(g=>`/sitemaps/${g.name}.xml`)),{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
