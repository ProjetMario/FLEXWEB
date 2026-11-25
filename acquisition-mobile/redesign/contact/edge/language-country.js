import {countryLanguage} from '../../../language/policy.mjs';
export default function country(request, context) {
  const headers = {'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex'};
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  headers['Content-Type'] = 'application/json; charset=utf-8';
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({language:countryLanguage(context.geo?.country?.code)}),{headers});
}
