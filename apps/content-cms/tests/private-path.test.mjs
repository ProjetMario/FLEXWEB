import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrivatePath, privateMediaPath } from '../src/lib/private-path.mjs';

test('private archives cannot pass through media proxy using encoded paths', () => {
  for (const prefix of ['flexweb/releases/', 'flexweb/release-status/', 'backups/']) {
    let path = '/_emdash/api/media/file/' + prefix + 'file.json';
    for (let depth = 0; depth < 4; depth++) {
      assert.equal(privateMediaPath(path), true);
      path = path.replaceAll('/', '%2F').replaceAll('%2F', depth ? '%252F' : '%2F');
      if (depth === 2) break;
    }
  }
});

test('invalid or excessively encoded paths fail closed, public media remains available', () => {
  assert.throws(() => normalizePrivatePath('/bad%'), URIError);
  assert.throws(() => normalizePrivatePath('/%2525252566lexweb'), /INVALID_PATH/);
  assert.equal(privateMediaPath('/_emdash/api/media/file/photos/image.jpg'), false);
});
