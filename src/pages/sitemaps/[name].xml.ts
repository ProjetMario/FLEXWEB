import {sitemapGroups} from '../../lib/seo/sitemaps';
import {urlset} from '../../lib/seo/xml.mjs';
export async function getStaticPaths(){return (await sitemapGroups()).map(g=>({params:{name:g.name},props:{items:g.items}}));}
export function GET({props}){return new Response(urlset(props.items),{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
