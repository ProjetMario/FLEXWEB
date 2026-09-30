import { defineMiddleware } from 'astro:middleware';
import { sameSecret, json } from './lib/contracts.mjs';
import { normalizePrivatePath, privateMediaPath } from './lib/private-path.mjs';

export const onRequest = defineMiddleware(async ({ url, request, cookies }, next) => {
  let decodedPath = url.pathname;
  try { decodedPath = normalizePrivatePath(url.pathname); } catch { return json({ error: 'INVALID_PATH' }, 400); }
  // The CMS is private; self-signup is disabled even if a future setting enables it.
  if (decodedPath.startsWith('/_emdash/api/auth/signup') || decodedPath === '/_emdash/admin/signup') return json({ error: 'REGISTRATION_DISABLED' }, 403);
  if (decodedPath.startsWith('/_emdash/api/auth/dev-bypass')) return json({ error: 'NOT_FOUND' }, 404);
  if (privateMediaPath(decodedPath)) return json({ error: 'NOT_FOUND' }, 404);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const setup = decodedPath.startsWith('/_emdash/api/setup') || decodedPath.startsWith('/_emdash/admin/setup') || decodedPath.startsWith('/_emdash/api/auth/register');
  if (!local && setup && !sameSecret(cookies.get('flexweb-bootstrap')?.value, process.env.FLEXWEB_SETUP_TOKEN)) return json({ error: 'SETUP_LOCKED', message: 'Accès initial réservé au propriétaire.' }, 403);
  if (!local && (request.headers.get('authorization') || cookies.has('astro-session')) && url.protocol !== 'https:') return json({ error: 'HTTPS_REQUIRED' }, 400);
  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
});
