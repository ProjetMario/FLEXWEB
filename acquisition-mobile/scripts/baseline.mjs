import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const site = '5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb';
export const baseId = '6b0452114b315390275a0f53';
export const baseUrl = 'https://' + baseId + '--flex-webb.netlify.app';
export const cache = join(root, '.release');
export const baseline = join(cache, 'baseline');
export const output = join(root, 'dist');
export const localPaths = ['aix-les-bains','albertville','annecy','chambery','haute-savoie','sallanches','savoie'].map(city => '/creation-application-mobile-' + city + '/');
export const linkPages = ['/pricing/', '/application-metier-sur-mesure/', '/journal/', ...localPaths];
export const sha = bytes => createHash('sha1').update(bytes).digest('hex');
export const filePath = route => route.endsWith('/') ? route + 'index.html' : route;
export const get = (directory, path) => readFile(join(directory, path));
export async function put(directory, path, bytes) {
  const target = join(directory, path);
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, bytes);
}
export async function api(path, options = {}, raw = false) {
  let token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) {
    const config = JSON.parse(await readFile(join(process.env.HOME, 'Library/Preferences/netlify/config.json'), 'utf8'));
    token = config.users[config.userId].auth.token;
  }
  const url = 'https://api.netlify.com/api/v1' + path;
  const res = await fetch(url, {...options, headers: {Authorization: 'Bearer ' + token, ...options.headers}});
  assert.ok(res.ok, 'Netlify ' + path + ' HTTP ' + res.status + ': ' + (res.ok ? '' : (await res.text()).slice(0, 400)));
  if (raw) return Buffer.from(await res.arrayBuffer());
  return res.status === 204 ? null : res.json();
}
export async function snapshot() {
  const deploy = (await api('/sites/' + site)).published_deploy;
  assert.equal(deploy.id, baseId, 'La production a changé. Rebaser le lot avant publication.');
  const listing = [];
  for (let page = 1; ; page++) {
    const batch = await api('/sites/' + site + '/files?per_page=100&page=' + page);
    listing.push(...batch);
    if (batch.length < 100) break;
    assert.ok(page < 50, 'Pagination Netlify inattendue');
  }
  assert.ok(listing.length && listing.every(f => f.deploy_id === baseId));
  const manifest = Object.fromEntries(listing.map(f => [f.path, f.sha]));
  assert.equal(Object.keys(manifest).length, listing.length);
  assert.equal(listing.length,351,'Inventaire incomplet du déploiement de référence');
  return {deploy, manifest};
}
export async function collect(manifest) {
  async function download(path) {
    const route = path.replace(/\/index\.html$/, '/');
    const response = await fetch(baseUrl + route, {redirect:'error'});
    assert.equal(response.status, 200, route);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha(bytes), manifest[path.toLowerCase()], 'Empreinte ' + path);
    await put(baseline, path, bytes);
    return bytes.toString();
  }
  const redirectSource = await get(join(root,'baseline'), '/_redirects');
  // Netlify consumes _redirects separately from its downloadable file manifest.
  assert.equal(sha(redirectSource), 'f5dc2f58bd43937284b574c445eafbb98cfd2db8');
  await put(baseline, '/_redirects', redirectSource);
  await Promise.all([...linkPages, '/llms.txt', '/llms-full.txt', '/ai-overview.txt', '/sitemap.xml','/robots.txt'].map(route => download(filePath(route))));
  const form = await download('/demarrer/index.html');
  const entry = form.match(/component-url="(\/_astro\/StartProject\.[\w-]+\.js)"/)[1];
  const code = await download(entry);
  await Promise.all([...new Set(Array.from(code.matchAll(/["']\.\/([\w.-]+\.js)["']/g), m => '/_astro/'+m[1]))].map(download));
}
