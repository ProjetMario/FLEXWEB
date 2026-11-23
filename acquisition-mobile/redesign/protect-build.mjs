// Run inside the CMS release after the new visual release is live.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'parse5';

const origin = 'https://flex-web.fr';
export async function protectDesign(directory, liveOrigin = origin) {
  const response = await fetch(new URL('/', liveOrigin), {redirect:'error', signal:AbortSignal.timeout(20000)});
  assert.equal(response.status, 200, 'Accueil courant inaccessible');
  if (!(await response.text()).includes('class="atelier-hero"')) return;

  const routes = ['/', '/en/', '/pricing/', '/demarrer/application/', '/creation-application-mobile/', '/entrepreneurs/metiers/electricien/', '/communes-france/'];
  const selected = new Map();
  for (const route of routes) {
    const file = join(directory, route, 'index.html');
    const html = await readFile(file, 'utf8');
    const sources = [];
    function styles(node) {
      const attrs = Object.fromEntries((node.attrs || []).map(a=>[a.name,a.value]));
      if (node.tagName === 'style') sources.push((node.childNodes || []).map(n=>n.value || '').join(''));
      if (node.tagName === 'link' && attrs.rel?.split(/\s+/).includes('stylesheet')) {
        const url = new URL(attrs.href, origin + route);
        if (url.origin === origin) {
          if (!selected.has(url.pathname)) selected.set(url.pathname, readFile(join(directory, url.pathname), 'utf8'));
          sources.push(selected.get(url.pathname));
        }
      }
      for (const child of node.childNodes || []) styles(child);
    }
    styles(parse(html));
    assert.ok((await Promise.all(sources)).some(css=>css.includes('--flex-studio-release')), route + ' a perdu sa feuille de style Flex-Web');
    if (route === '/' || route === '/en/') {
      assert.match(html, /data-device="desktop"/);
      assert.match(html, /data-device="phone"/);
    }
  }
}
