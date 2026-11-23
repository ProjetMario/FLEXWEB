import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';

export const offerRoutes = new Map([
  ['/creation-application-mobile/', 'mobile'],
  ['/creation-site-internet/', 'web'],
  ['/automatisation-ia/', 'automation'],
]);

function elements(html) {
  const found = [];
  function visit(node) {
    if (node.tagName) found.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html, {sourceCodeLocationInfo:true}));
  return found;
}
function single(nodes, tagName) {
  const matches = nodes.filter(node => node.tagName === tagName);
  assert.equal(matches.length, 1, tagName);
  return matches[0];
}

export async function composeOffer(html, route) {
  // The host supplies its real navigation, head, consent and integrations.
  const file = new URL('../../.release/redesign/offers' + route + 'index.html', import.meta.url);
  const fragment = await readFile(file, 'utf8');
  const sourceNodes = elements(fragment);
  const layoutNodes = elements(html);
  // The earlier website offer also contains a nested main. Replacing its outer
  // landmark removes both old sections while retaining the host header/footer.
  const mains = layoutNodes.filter(node => node.tagName === 'main');
  assert.ok(mains.length, route + ' has no main landmark');
  const range = mains[0].sourceCodeLocation;
  assert.ok(mains.every(n => n.sourceCodeLocation.startOffset >= range.startOffset && n.sourceCodeLocation.endOffset <= range.endOffset), route + ' has separate main landmarks');
  const content = single(sourceNodes, 'main');
  const inner = content.sourceCodeLocation;
  const view = offerRoutes.get(route);
  assert.ok(content.attrs.some(attr => attr.name === 'data-offer' && attr.value === view));
  const styles = sourceNodes.filter(n => n.tagName === 'style').map(n => {
    const {startOffset,endOffset} = n.sourceCodeLocation;
    return fragment.slice(startOffset,endOffset);
  });
  assert.ok(styles.length, route + ' missing compiled styles');
  assert.ok(!sourceNodes.some(n => n.tagName === 'script' || (n.tagName === 'link' && n.attrs.some(a => a.value === 'stylesheet'))), 'Expected a static Astro fragment with inline styles');
  const mainHTML = fragment.slice(inner.startOffset, inner.endOffset);
  const headEnd = single(layoutNodes, 'head').sourceCodeLocation.endTag.startOffset;
  return html.slice(0,headEnd) + styles.join('') + html.slice(headEnd,range.startOffset) + mainHTML + html.slice(range.endOffset);
}
