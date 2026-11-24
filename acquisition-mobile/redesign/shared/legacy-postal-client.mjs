// The build appends the shared brand and postal data to this browser module.
function makeAddress() {
  const address = document.createElement('address');
  address.dataset.flexwebPostalAddress = '';
  address.className = 'studio-postal-address';
  const title = document.createElement('strong');
  title.textContent = brand;
  const lang = document.documentElement.lang || 'fr';
  const country = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([lang], {type:'region'}).of(postal.addressCountry)
    : ({de:'Frankreich', it:'Francia'})[lang] || 'France';
  address.append(title, document.createElement('br'), postal.streetAddress, document.createElement('br'),
    postal.postalCode+' '+postal.addressLocality+', '+country);
  return address;
}

// React calls this DOM ref during its commit, after reconciling the server HTML.
// Listening to Astro's hydration event is too early with a concurrent React root.
export function attachPostalAddress(footer) {
  if (!footer || footer.querySelector('[data-flexweb-postal-address]')) return;
  const logo = footer.querySelector('a > img[src="/logo.png"][alt="Flexweb"]');
  const intro = logo?.parentElement?.nextElementSibling;
  if (intro?.tagName === 'P') intro.after(makeAddress());
}

export function installDirectoryAddress() {
  function update() {
    const nav = document.querySelector('footer > nav[aria-label="Footer navigation"]');
    const directory = nav?.nextElementSibling;
    if (!directory || directory.tagName !== 'P' || nav.closest('astro-island')) return;
    const first = directory.firstChild;
    if (first?.nodeType !== Node.TEXT_NODE || !first.data.includes(postal.streetAddress) ||
      !directory.querySelector('a[href="/en/contact/"], a[href^="mailto:"]')) return;
    directory.before(makeAddress());
    first.remove();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, {once:true});
  else update();
}
