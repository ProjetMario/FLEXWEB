import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {footerBrand, postalAddress} from '../../../src/data/business.ts';

const attribute = (node, key) => node.attrs?.find(entry => entry.name === key)?.value;
const elements = node => (node.childNodes || []).filter(child => child.tagName);
function find(node, test) {
  if (test(node)) return node;
  for (const child of node.childNodes || []) {
    const match = find(child, test);
    if (match) return match;
  }
}

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const cookieListener = '<script>document.querySelector("[data-flexweb-footer-cookies]").addEventListener("click",()=>window.dispatchEvent(new Event("flexweb-cookie-settings")));</script>';

// The certified catalogue contains static Astro layouts and older React footer
// islands. Keep their exact links and copy when restoring a static address.
export function withPostalFooter(source, language) {
  const tree = parse(source, {sourceCodeLocationInfo:true});
  const footer = find(tree, node => node.tagName === 'footer');
  if (!footer || find(footer, node => attribute(node, 'data-flexweb-postal-address') !== undefined)) return source;
  const lang = language || attribute(find(tree, node => node.tagName === 'html'), 'lang') || 'fr';
  const country = ({de:'Frankreich', it:'Francia'})[lang] || 'France';
  const address = '<address data-flexweb-postal-address="" style="font-style:normal"><strong>'+escape(footerBrand)+'</strong><br>'+
    escape(postalAddress.streetAddress)+'<br>'+escape(postalAddress.postalCode+' '+postalAddress.addressLocality+', '+country)+'</address>';
  const changes = [];
  const replace = (start,end,text) => changes.push({start,end,text});
  const cls = (attribute(footer,'class') || '').split(/\s+/);
  const cookie = find(footer, node => node.tagName === 'button');
  const first = elements(footer)[0];
  if (cls.includes('studio-foot')) {
    if (!attribute(footer,'id')) {
      const tagEnd = footer.sourceCodeLocation.startTag.endOffset-1;
      replace(tagEnd,tagEnd,' id="coordonnees"');
    }
    const copyright = elements(first)[0];
    assert.equal(copyright.tagName,'span');
    const pos = copyright.sourceCodeLocation.startOffset;
    replace(pos,pos,address);
  } else if (cls.includes('site-footer')) {
    const brand = elements(first)[0];
    assert.equal(brand.tagName,'div');
    const pos = brand.sourceCodeLocation.endTag.startOffset;
    replace(pos,pos,address);
  } else if (attribute(cookie || {},'id') === 'project-cookie-settings') {
    const intro = footer.childNodes[0];
    assert.match(intro.value,/Fleximmo.*Voglans/);
    replace(intro.sourceCodeLocation.startOffset,intro.sourceCodeLocation.endOffset,address);
  } else if (attribute(cookie || {},'id') === 'english-cookie-settings') {
    const para = elements(footer).find(n=>n.tagName==='p');
    const intro = para.childNodes[0];
    assert.ok(intro.value.includes(postalAddress.streetAddress));
    replace(para.sourceCodeLocation.startOffset,intro.sourceCodeLocation.endOffset,address+'<p>');
  } else if (/\/Footer\.[^/]+\.js$/.test(attribute(footer.parentNode,'component-url') || '')) {
    const island = footer.parentNode.sourceCodeLocation;
    const logo = find(footer, node => node.tagName==='img');
    const column = logo?.parentNode?.parentNode;
    assert.equal(column?.tagName,'div');
    const pos = column.sourceCodeLocation.endTag.startOffset;
    replace(pos,pos,address);
    // Its only interactive control opens the existing consent preferences.
    assert.equal(cookie?.tagName,'button');
    const buttonStart = cookie.sourceCodeLocation.startTag.endOffset-1;
    replace(buttonStart,buttonStart,' data-flexweb-footer-cookies');
    replace(island.startOffset,island.startTag.endOffset,'');
    replace(island.endTag.startOffset,island.endOffset,cookieListener);
  } else {
    return source;
  }
  let result = source;
  for (const edit of changes.sort((a,b)=>b.start-a.start)) result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
  return result;
}
