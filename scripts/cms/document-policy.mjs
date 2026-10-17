import {parse} from 'parse5';

// Prospect demos are generated from a reviewed CRM allowlist. They are not
// editorial CMS pages, even though they use a self canonical URL.
export function isProspectMockup(html) {
  if (!/flexweb-content-kind/i.test(html)) return false;
  const document = parse(html);
  const root = document.childNodes?.find(node => node.tagName === 'html');
  const head = root?.childNodes?.find(node => node.tagName === 'head');
  return (head?.childNodes ?? []).some(node => {
    if (node.tagName !== 'meta') return false;
    const attrs = Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]));
    return (attrs.name ?? '').toLowerCase() === 'flexweb-content-kind' && attrs.content === 'prospect-mockup';
  });
}
