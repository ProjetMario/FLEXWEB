import assert from 'node:assert/strict';
import test from 'node:test';
import {sha} from '../scripts/baseline.mjs';
import {assemble} from './manifest.mjs';

const item = path => ({path, bytes: Buffer.from(path)});
const unchanged = sha(Buffer.from('original'));
const original = {
  '/index.html': unchanged, '/en/index.html': unchanged, '/contact/index.html': unchanged,
  '/_astro/global.abc.css': unchanged, '/sitemap.xml': unchanged,
};
const outputs = () => ({
  home: ['/index.html', '/en/index.html', '/studio-redesign/banner.webp'].map(item),
  shared: ['/contact/index.html', '/_astro/global.AbC.css'].map(item),
});
const report = {changedHTML: ['/contact/index.html'], changedStylesheets: ['/_astro/global.AbC.css']};

test('la surcouche conserve les anciens fichiers et la casse publique de la feuille', () => {
  const {files, uploads, changes} = assemble(original, outputs(), report);
  assert.equal(files['/sitemap.xml'], unchanged);
  assert.equal(files['/_astro/global.abc.css'], sha(Buffer.from('/_astro/global.AbC.css')));
  assert.equal(uploads.get(files['/_astro/global.abc.css']).path, '/_astro/global.AbC.css');
  assert.equal(changes.size, 5);
  assert.equal(Object.keys(files).length, Object.keys(original).length + 1);
});

test('refuse les écritures concurrentes, changements de XML ou nouveaux HTML', () => {
  for (const path of ['/sitemap.xml', '/studio-redesign/app/index.html', '/netlify.toml', '/index.html', '/studio-redesign/banner.webp']) {
    const input = outputs();
    input.shared.push(item(path));
    assert.throws(() => assemble(original, input, report));
  }
});

test('refuse une langue ou un gabarit annoncé mais absent', () => {
  for (const target of ['shared', 'home']) {
    const input = outputs();
    input[target].shift();
    assert.throws(() => assemble(original, input, report));
  }
});
