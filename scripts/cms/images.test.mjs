import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {extractImages, applyImages} from './images.mjs';

const html = `<!doctype html><html><body><nav><img src="/nav.png"></nav><main><h1>Projet</h1><a class="preview" href="/projet/"><picture><source type="image/webp" srcset="/small.webp 480w, /large.webp 1280w"><img class='capture' src='/capture.png' alt='Aperçu du projet' width="1280" height="960" loading="lazy" decoding="async" sizes="(max-width: 640px) 100vw, 50vw" srcset="/small.png 480w, /capture.png 1280w"></picture></a><p>Preuve réelle.</p><img src="/second.png" alt="" /><form><img src="/form.png"></form><astro-island><img src="/island.png"></astro-island><footer><img src="/footer-in-main.png"></footer><div data-cms-lock><img src="/locked.png"></div><div data-cms-generated><img src="/generated.png"></div></main><footer><img src="/footer.png"></footer></body></html>`;
const edit = (changes, input = html) => extractImages(input).map((item, index) => index === 0 ? {...item, ...changes} : item);
const attrsOf = (source, tagName) => {
  const matches = [];
  function visit(node) { if (node.tagName === tagName) matches.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]))); for (const child of node.childNodes ?? []) visit(child); }
  visit(parse(source));
  return matches;
};

test('extracts only editable main images with stable baseline keys and dimensions', () => {
  const images = extractImages(html);
  assert.equal(images.length, 2);
  assert.deepEqual(Object.keys(images[0]), ['key', 'src', 'alt', 'width', 'height']);
  assert.deepEqual({...images[0], key: 'key'}, {key: 'key', src: '/capture.png', alt: 'Aperçu du projet', width: 1280, height: 960});
  assert.equal(images[1].width, null);
  assert.deepEqual(extractImages(html.replace('Projet</h1>', 'Autre titre</h1>')), images);
  assert.deepEqual(extractImages(html.replace("class='capture'", 'class="capture"')), images);
  assert.throws(() => extractImages('<img src="/photo.png">'), /principal/);
  assert.throws(() => extractImages('<main></main><main></main>'), /principal/);
});

test('an unchanged list returns byte-identical HTML including attributes and wrappers', () => {
  assert.equal(applyImages(html, extractImages(html)), html);
  const second = '<main><img src="/x.png" alt="   Deux\n espaces  " width="100%"></main>';
  assert.equal(applyImages(second, extractImages(second)), second);
});

test('alt edits preserve original responsive sources and safely escape markup', () => {
  const result = applyImages(html, edit({alt: ' <script>injection</script> " onerror="alert(1) & salut\n monde '}));
  const image = attrsOf(result, 'img').find(item => item.class === 'capture');
  assert.equal(image.alt, '<script>injection</script> " onerror="alert(1) & salut monde');
  assert.equal(image.onerror, undefined);
  assert.equal(attrsOf(result, 'script').length, 0);
  assert.match(result, /srcset="\/small\.webp 480w, \/large\.webp 1280w"/);
  assert.match(result, /srcset="\/small\.png 480w, \/capture\.png 1280w"/);
  assert.match(result, /class='capture'/);
});

test('changing src drops stale img and picture srcsets but preserves wrappers and sizes', () => {
  const result = applyImages(html, edit({src: '/images/realisation.png?w=1280&quality=80'}));
  const image = attrsOf(result, 'img').find(item => item.class === 'capture');
  assert.equal(image.src, '/images/realisation.png?w=1280&quality=80');
  assert.equal(image.srcset, undefined);
  assert.equal(attrsOf(result, 'source')[0].srcset, undefined);
  assert.equal(attrsOf(result, 'source')[0].type, 'image/webp');
  assert.equal(image.loading, 'lazy');
  assert.equal(image.decoding, 'async');
  assert.equal(image.sizes, '(max-width: 640px) 100vw, 50vw');
  assert.equal(attrsOf(result, 'picture').length, 1);
  assert.match(result, /<a class="preview" href="\/projet\/">/);
  assert.match(result, /quality=80/);
  assert.match(result, /&amp;quality/);
});

test('all keys must remain unique and match the unmodified source baseline', () => {
  const original = extractImages(html);
  assert.throws(() => applyImages(html, original.slice(1)), /conservées/);
  assert.throws(() => applyImages(html, [original[0], original[0]]), /dupliquée/);
  assert.throws(() => applyImages(html, edit({key: 'unknown'})), /source modifiée/);
  assert.throws(() => applyImages(html.replace('/small.webp', '/new.webp'), original), /source modifiée/);
  assert.throws(() => applyImages(html.replace('loading="lazy"', 'loading="eager"'), original), /source modifiée/);
  assert.throws(() => applyImages(html, edit({onerror: 'bad'})), /champs/);
  assert.throws(() => applyImages(html, edit({src: undefined})), /URL/);
  assert.throws(() => applyImages(html, edit({alt: undefined})), /alternatif/);
});

test('identical image tags still receive separate occurrence keys', () => {
  const source = '<main><img src="/same.png" alt="X"><img src="/same.png" alt="X"></main>';
  const images = extractImages(source);
  assert.notEqual(images[0].key, images[1].key);
  images[1].alt = 'Deuxième';
  assert.equal(attrsOf(applyImages(source, images), 'img')[1].alt, 'Deuxième');
});

test('dimensions remain unchanged unless a valid integer is supplied; removal is refused', () => {
  const result = applyImages(html, edit({width: 1920, height: 1080}));
  const image = attrsOf(result, 'img').find(item => item.class === 'capture');
  assert.equal(image.width, '1920');
  assert.equal(image.height, '1080');
  assert.equal(applyImages(html, edit({width: undefined, height: undefined})), html);
  for (const width of [null, 0, -1, 1.5, '1280', 8193, NaN]) assert.throws(() => applyImages(html, edit({width})), /dimension/);
  const source = '<main><img src="/new.png"/></main>';
  const added = applyImages(source, edit({alt: 'Nouveau', width: 100, height: 200}, source));
  assert.deepEqual(attrsOf(added, 'img')[0], {src: '/new.png', alt: 'Nouveau', width: '100', height: '200'});
  assert.match(added, /\/>/);
});

test('local paths reject traversal, encoding tricks, controls and URL injection', () => {
  const invalid = ['//evil.test/a.png', '/a/../b.png', '/a/./b.png', '/a/%2e%2e/b.png', '/a/%252e%252e/b.png', '/%252525252e%252525252e/secret', '/%2fexample.test/a', '/%5cevil.png', '/a\\b.png', '/a\tb.png', '/a\u0000b.png', '/%00x.png', '/a%0db.png', '/a%3fb.png', '/a%23b.png', '/broken%zz.png', '/x"onerror="bad', '/x<svg>', 'javascript:alert(1)', 'data:image/png;base64,AA', 'http://cms.example.test/x.png'];
  for (const src of invalid) assert.throws(() => applyImages(html, edit({src})), undefined, src);
  for (const src of ['/images/a.webp', '/_image?href=%2Fphoto.png&w=600', '/images/icon.svg#mark']) assert.doesNotThrow(() => applyImages(html, edit({src})));
});

test('HTTPS images require exactly the configured CMS origin and its native media route', () => {
  const options = {mediaOrigin: 'https://cms.example.test'};
  const src = 'https://cms.example.test/_emdash/api/media/file/uploads/2026/photo.webp';
  assert.equal(attrsOf(applyImages(html, edit({src}), options), 'img').find(item => item.class === 'capture').src, src);
  assert.throws(() => applyImages(html, edit({src})), /origine/);
  for (const url of ['https://evil.test/_emdash/api/media/file/uploads/x.png', 'https://cms.example.test.evil.test/_emdash/api/media/file/x.png', 'https://u:p@cms.example.test/_emdash/api/media/file/x.png', 'https://cms.example.test/uploads/x.png', 'https://cms.example.test/_emdash/api/media/file/', 'https://cms.example.test/_emdash/api/media/file/a/../x.png']) assert.throws(() => applyImages(html, edit({src: url}), options), undefined, url);
  for (const mediaOrigin of ['http://cms.example.test', 'https://u@cms.example.test', 'https://cms.example.test/sub', 'https://cms.example.test?x=y', ' https://cms.example.test']) assert.throws(() => applyImages(html, edit({src}), {mediaOrigin}), /origine/);
});

test('private native media prefixes cannot be exposed even with trusted origin or encoded path', () => {
  for (const path of ['/_emdash/api/media/file/flexweb/archive.zip', '/_emdash/api/media/file/backups/private.json', '/_emdash/api/media/file/%66lexweb/secret', '/_emdash/api/media/file/%2562ackups/secret', '/_emdash/api/media/file/FLEXWEB/secret', '/_emdash/api/media/file/backups']) {
    assert.throws(() => applyImages(html, edit({src: path})), /privé/);
    assert.throws(() => applyImages(html, edit({src: `https://cms.example.test${path}`}), {mediaOrigin: 'https://cms.example.test'}), /privé/);
  }
});
