// These three archived catalogues are preserved byte-for-byte in the release
// manifest. Replace the old contact details before serving their static HTML.
import {hasPublicMailbox, transformPublicContact} from '../../../../scripts/contact/public-contact.mjs';

export default async function publicContact(request, context) {
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
    const path = new URL(request.url).pathname;
    body = transformPublicContact(path.endsWith('.html') ? path : path + '/index.html', await response.text());
    if (hasPublicMailbox(body)) throw new Error('The archived contact could not be replaced');
  }
  return new Response(body, {status: response.status, headers: resultHeaders});
}
