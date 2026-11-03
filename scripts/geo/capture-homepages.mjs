import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homepageContent } from './homepage-content.mjs';

const snapshot = {};
for (const path of ['/', '/en/']) {
  const response = await fetch('https://flex-web.fr' + path, {redirect:'error', signal:AbortSignal.timeout(30000)});
  assert.equal(response.status, 200, path);
  snapshot[path] = homepageContent(await response.text());
}
await mkdir('.cms', {recursive:true});
await writeFile('.cms/geo-homepages-baseline.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify({protectedHomepages:Object.keys(snapshot)}));
