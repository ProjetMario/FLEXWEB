import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';

export const fragmentRoutes = new Map([
  ['/creation-application-mobile/', 'mobile'],
  ['/creation-site-internet/', 'web'],
  ['/automatisation-ia/', 'automation'],
  ['/contact/', 'contact'],
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

const contactHeadFields = ['title', 'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'];
function headField(node) {
  if (node.tagName === 'title') return 'title';
  if (node.tagName === 'meta') return node.attrs.find(attr => ['name','property'].includes(attr.name))?.value;
}

function replaceContactHead(head, hostNodes, fragment, fragmentNodes) {
  const replacements = contactHeadFields.map(key => {
    const host = hostNodes.filter(node => headField(node) === key);
    const fresh = fragmentNodes.filter(node => headField(node) === key);
    assert.equal(host.length, 1, 'Unexpected host metadata: '+key);
    assert.equal(fresh.length, 1, 'Missing contact metadata: '+key);
    const {startOffset,endOffset} = fresh[0].sourceCodeLocation;
    return {...host[0].sourceCodeLocation, markup:fragment.slice(startOffset,endOffset)};
  });
  for (const {startOffset,endOffset,markup} of replacements.sort((a,b) => b.startOffset-a.startOffset)) {
    head = head.slice(0,startOffset) + markup + head.slice(endOffset);
  }
  return head;
}

export async function composeFragment(html, route) {
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
  const view = fragmentRoutes.get(route);
  assert.ok(content.attrs.some(attr => attr.name === (view === 'contact' ? 'data-view' : 'data-offer') && attr.value === view));
  const styles = sourceNodes.filter(n => n.tagName === 'style').map(n => {
    const {startOffset,endOffset} = n.sourceCodeLocation;
    return fragment.slice(startOffset,endOffset);
  });
  assert.ok(styles.length, route + ' missing compiled styles');
  const metadata = sourceNodes.filter(n => n.tagName === 'link' && n.attrs.some(a => a.name === 'hreflang') || n.tagName === 'script' && n.attrs.some(a => a.name === 'type' && a.value === 'application/ld+json'));
  assert.ok(!sourceNodes.some(n => (n.tagName === 'script' && !metadata.includes(n)) || (n.tagName === 'link' && n.attrs.some(a => a.value === 'stylesheet'))), 'Expected a static Astro fragment with inline styles');
  const mainHTML = fragment.slice(inner.startOffset, inner.endOffset);
  const headEnd = single(layoutNodes, 'head').sourceCodeLocation.endTag.startOffset;
  const extraHead = metadata.map(n => fragment.slice(n.sourceCodeLocation.startOffset, n.sourceCodeLocation.endOffset)).join('');
  const originalHead = html.slice(0,headEnd);
  const head = view === 'contact' ? replaceContactHead(originalHead, layoutNodes, fragment, sourceNodes) : originalHead;
  return head + styles.join('') + extraHead + html.slice(headEnd,range.startOffset) + mainHTML + html.slice(range.endOffset);
}
