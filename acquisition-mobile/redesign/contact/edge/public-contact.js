import {readingMarkup} from '../../../language/markup.mjs';
import {hasPublicMailbox, transformPublicContact} from '../../../../scripts/contact/public-contact.mjs';

export default async function publicContact(request, context) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/automation/')) {
    // Successful private responses and visitor-supplied project data pass through untouched.
    const response = await context.next();
    if (response.status < 400 || !response.headers.get('content-type')?.includes('application/json')) return response;
    let data;
    try { data = await response.clone().json(); } catch { return response; }
    if (typeof data?.error !== 'string' || !hasPublicMailbox(data.error)) return response;
    data.error = transformPublicContact('/error.txt', data.error);
    const headers = new Headers(response.headers);
    for (const key of ['content-length','content-encoding','etag','last-modified']) headers.delete(key);
    return new Response(JSON.stringify(data), {status:response.status, headers});
  }
  if (path.startsWith('/api/') || (/\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path))) return;
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  const headers = new Headers(request.headers);
  for (const name of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) headers.delete(name);
  const response = await context.next(new Request(request, {headers}));
  if (response.status !== 200 && response.status !== 404) return response;
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) return response;
  const resultHeaders = new Headers(response.headers);
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified', 'accept-ranges', 'content-range']) resultHeaders.delete(name);
  let body = null;
  if (request.method === 'GET') {
    const filename = /\.html?$/i.test(path) ? path : path.replace(/\/?$/, '/index.html');
    body = transformPublicContact(filename, await response.text());
    if (response.status === 200) body = readingMarkup(path,body,context.deploy?.context === 'deploy-preview' || /^[a-f0-9]{24}--flex-webb\.netlify\.app$/.test(new URL(request.url).hostname));
    if (hasPublicMailbox(body)) throw new Error('The archived contact could not be replaced');
  }
  return new Response(body, {status: response.status, headers: resultHeaders});
}
