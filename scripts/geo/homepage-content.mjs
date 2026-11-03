import { parse } from 'parse5';

const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value ?? null;
const skip = new Set(['script', 'style', 'template', 'noscript']);
const normalize = text => text.replace(/\s+/g, ' ').trim();
function plain(node) {
  if (skip.has(node.tagName)) return '';
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(plain).join(' ');
}
function descendants(node) {
  return skip.has(node.tagName) ? [] : [node, ...(node.childNodes || []).flatMap(descendants)];
}

// Ignore generated asset hashes and hydration code, but preserve every public
// word, heading, link, image, control and ordering on both protected homepages.
export function homepageContent(html) {
  const all = descendants(parse(html));
  const body = all.find(node => node.tagName === 'body');
  const content = descendants(body);
  return {
    title: normalize(plain(all.find(node => node.tagName === 'title'))),
    description: attr(all.find(node => node.tagName === 'meta' && attr(node, 'name') === 'description'), 'content'),
    text: normalize(plain(body)),
    headings: content.filter(node => /^h[1-6]$/.test(node.tagName)).map(node => [node.tagName, normalize(plain(node))]),
    links: content.filter(node => node.tagName === 'a').map(node => [attr(node, 'href'), normalize(plain(node)), attr(node, 'aria-label')]),
    images: content.filter(node => node.tagName === 'img').map(node => [attr(node, 'src'), attr(node, 'alt'), attr(node, 'width'), attr(node, 'height')]),
    controls: content.filter(node => ['button', 'input', 'select', 'textarea'].includes(node.tagName)).map(node => [node.tagName, attr(node, 'name'), attr(node, 'type'), attr(node, 'aria-label'), normalize(plain(node))]),
  };
}
