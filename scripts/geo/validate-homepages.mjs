import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { homepageContent } from './homepage-content.mjs';

const snapshot = JSON.parse(await readFile('.cms/geo-homepages-baseline.json', 'utf8'));
for (const route of ['/', '/en/']) {
  const html = await readFile(path.join('dist', route, 'index.html'), 'utf8');
  assert.deepEqual(homepageContent(html), snapshot[route], `${route}: protected homepage content changed`);
}
console.log(JSON.stringify({protectedHomepages:2, contentUnchanged:true}));
