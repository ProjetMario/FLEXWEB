import {createHash} from 'node:crypto';
import {parse} from 'parse5';

const excluded = new Set(['nav', 'footer', 'form', 'astro-island', 'script', 'style', 'noscript', 'template']);
const fields = new Set(['key', 'src', 'alt', 'width', 'height']);
const mediaPrefix = '/_emdash/api/media/file/';
const tag = node => node.tagName ?? '';
const attributes = node => Object.fromEntries((node.attrs ?? []).map(({name, value}) => [name, value]));
const fingerprintAttrs = node => [...(node.attrs ?? [])].map(({name, value, namespace}) => [namespace ?? '', name, value]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const fail = message => { throw new Error(`Images CMS : ${message}`); };

function dimension(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 1 && result <= 8192 ? result : null;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function inspect(html) {
  if (typeof html !== 'string') fail('HTML invalide');
  const document = parse(html, {sourceCodeLocationInfo: true});
  const mains = [];
  walk(document, node => { if (tag(node) === 'main') mains.push(node); });
  if (mains.length !== 1) fail('un unique contenu principal est requis');
  const entries = [], locations = new Map(), counts = new Map();
  function collect(node, picture = null) {
    const attrs = attributes(node);
    if (excluded.has(tag(node)) || 'data-cms-lock' in attrs || 'data-cms-generated' in attrs) return;
    if (tag(node) === 'picture') picture = node;
    if (tag(node) === 'img') {
      const location = node.sourceCodeLocation;
      if (!location) fail('image sans emplacement source');
      const sources = (picture?.childNodes ?? []).filter(child => tag(child) === 'source');
      // Bind editable records to the original responsive sources and attributes.
      // Whitespace/quote formatting and unrelated text changes do not invalidate keys.
      const signature = hash({image: fingerprintAttrs(node), sources: sources.map(fingerprintAttrs)}).slice(0, 24);
      const count = counts.get(signature) ?? 0;
      counts.set(signature, count + 1);
      const entry = {key: `i${signature}_${count}`, src: attrs.src ?? '', alt: attrs.alt ?? '', width: dimension(attrs.width), height: dimension(attrs.height)};
      entries.push(entry);
      locations.set(entry.key, {entry, node, sources});
    }
    for (const child of node.childNodes ?? []) collect(child, picture);
  }
  collect(mains[0]);
  return {entries, locations};
}

/** Original images in public <main>, excluding navigation, forms and interactive islands. */
export function extractImages(html) {
  return inspect(html).entries;
}

function decodePath(value) {
  let result = value;
  for (let pass = 0; pass < 4; pass++) {
    let decoded;
    try { decoded = decodeURIComponent(result); } catch { fail('encodage URL invalide'); }
    if (decoded === result) return result;
    result = decoded;
    if (!/%[0-9a-f]{2}/i.test(result)) return result;
  }
  fail('encodage URL imbriqué interdit');
}

function safePath(rawPath) {
  const path = decodePath(rawPath);
  if (!path.startsWith('/') || path.startsWith('//') || /[\s\u0000-\u001f\u007f-\u009f\\<>"'`?#]/u.test(path)) fail('chemin image invalide');
  if (path.split('/').some(part => part === '.' || part === '..')) fail('traversée de chemin interdite');
  if (path.toLowerCase().startsWith(mediaPrefix)) {
    const root = path.slice(mediaPrefix.length).split('/')[0].toLowerCase();
    if (!root || root === 'flexweb' || root === 'backups') fail('média privé interdit');
  }
  return path;
}

function allowedOrigin(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || /[\s\\]/u.test(value)) fail('origine média invalide');
  let url;
  try { url = new URL(value); } catch { fail('origine média invalide'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('origine média HTTPS requise');
  return url.origin;
}

function safeSource(value, origin) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\s\u0000-\u001f\u007f-\u009f\\<>"'`]/u.test(value)) fail('URL image invalide');
  if (value.startsWith('/')) {
    safePath(value.split(/[?#]/, 1)[0]);
    return value;
  }
  // Examine the unnormalised path first: URL would otherwise erase ../ segments.
  const match = value.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i);
  if (!match) fail('protocole image interdit');
  const path = safePath(match[2] ?? '/');
  let url;
  try { url = new URL(value); } catch { fail('URL image invalide'); }
  if (!origin || url.origin !== origin || url.username || url.password) fail('origine média non autorisée');
  if (!path.startsWith(mediaPrefix) || !path.slice(mediaPrefix.length)) fail('URL média EmDash native requise');
  return value;
}

function safeAlt(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) fail('texte alternatif invalide');
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Apply a complete image list to its original HTML baseline, without rebuilding tags.
 * Keys must still match the baseline; optional dimensions retain the original when omitted.
 * External sources require the explicit CMS HTTPS origin and its native public media path.
 */
export function applyImages(html, overrides, {mediaOrigin} = {}) {
  const {entries, locations} = inspect(html);
  if (!Array.isArray(overrides) || overrides.length !== entries.length || overrides.length > 2000) fail('toutes les images existantes doivent être conservées');
  const origin = allowedOrigin(mediaOrigin), seen = new Set(), replacements = new Map(), additions = new Map();
  function replace(start, end, value) {
    const key = `${start}:${end}`, previous = replacements.get(key);
    if (previous && previous.value !== value) fail('modifications image contradictoires');
    replacements.set(key, {start, end, value});
  }
  function updateAttribute(node, name, value) {
    const location = node.sourceCodeLocation, attr = location.attrs?.[name];
    if (attr) { replace(attr.startOffset, attr.endOffset, value === null ? '' : `${name}="${escape(value)}"`); return; }
    if (value === null) return;
    const end = location.startTag?.endOffset ?? location.endOffset;
    const offset = html.slice(end - 2, end) === '/>' ? end - 2 : end - 1;
    const current = additions.get(offset) ?? new Map();
    current.set(name, ` ${name}="${escape(value)}"`);
    additions.set(offset, current);
  }
  for (const override of overrides) {
    if (!override || typeof override !== 'object' || Array.isArray(override) || Object.keys(override).some(field => !fields.has(field))) fail('champs image invalides');
    if (typeof override.key !== 'string' || seen.has(override.key)) fail('clé image absente ou dupliquée');
    seen.add(override.key);
    const original = locations.get(override.key);
    if (!original) fail('image source modifiée ou inconnue : comparer la nouvelle base avant publication');
    const {entry, node, sources} = original;
    const src = override.src === entry.src ? entry.src : safeSource(override.src, origin), alt = safeAlt(override.alt);
    if (src !== entry.src) {
      updateAttribute(node, 'src', src);
      updateAttribute(node, 'srcset', null);
      // Otherwise <picture> selects an old source instead of the newly chosen image.
      for (const source of sources) updateAttribute(source, 'srcset', null);
    }
    // Untouched alternative text keeps its exact original whitespace and quoting.
    if (override.alt !== entry.alt) updateAttribute(node, 'alt', alt);
    for (const field of ['width', 'height']) {
      const value = override[field];
      if (value === undefined || value === entry[field]) continue;
      if (!Number.isSafeInteger(value) || value < 1 || value > 8192) fail('dimension image comprise entre 1 et 8192 requise');
      updateAttribute(node, field, value);
    }
  }
  for (const [offset, attrs] of additions) replace(offset, offset, [...attrs.values()].join(''));
  let result = html;
  for (const {start, end, value} of [...replacements.values()].sort((a, b) => b.start - a.start)) result = result.slice(0, start) + value + result.slice(end);
  return result;
}
