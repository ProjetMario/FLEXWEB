import assert from 'node:assert/strict';
import {parse} from 'parse5';

const names = {en: 'English', fr: 'Français'};
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
function find(node, test) {
  if (test(node)) return node;
  for (const child of node.childNodes || []) {
    const match = find(child, test);
    if (match) return match;
  }
}
function encodeAttribute(text) {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

// Change the text and its original React prop together. The historical client
// module can then hydrate the archived HTML and re-render the same label.
export function expandLanguageName(html) {
  const island = find(parse(html, {sourceCodeLocationInfo:true}), node =>
    node.tagName === 'astro-island' && /\/Navigation\.[^/]+\.js$/.test(attr(node, 'component-url') || ''));
  if (!island) return html;
  const props = JSON.parse(attr(island, 'props') || '{}');
  if (!props.languageLink) return html;
  const [kind, link] = props.languageLink;
  assert.equal(kind, 0, 'Unrecognized Astro object encoding for languageLink');
  const code = link.lang[1];
  const fullName = names[code];
  assert.ok(fullName, 'Check the language name for ' + code);
  const anchor = find(island, node => node.tagName === 'a' &&
    attr(node, 'hreflang') === code && attr(node, 'href') === link.href[1]);
  assert.ok(anchor && anchor.childNodes.length === 1, 'A single language label was expected');
  const child = anchor.childNodes[0];
  assert.equal(child.nodeName, '#text');
  assert.deepEqual(link.label, [0, child.value]);
  assert.ok(attr(anchor, 'aria-label')?.toLowerCase().includes(fullName.toLowerCase()));
  if (child.value === fullName) return html;
  assert.equal(child.value, code.toUpperCase(), 'Check unexpected language switch text');
  link.label[1] = fullName;
  const text = child.sourceCodeLocation, propsAttr = island.sourceCodeLocation.attrs.props;
  // The serialized props precede the text node in the original document.
  return html.slice(0, propsAttr.startOffset) + 'props="' + encodeAttribute(JSON.stringify(props)) + '"' +
    html.slice(propsAttr.endOffset, text.startOffset) + fullName + html.slice(text.endOffset);
}
