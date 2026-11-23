// This file is shared by the archived React footer and the static English directory.
// It only edits the displayed address. It needs no cookies, storage or network access.
function installPostalFooter(brand, postal) {
  const makeAddress = () => {
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
  };
  function update() {
    const footer = document.querySelector('footer');
    if (!footer || footer.querySelector('[data-flexweb-postal-address]')) return;
    const logo = footer.querySelector('a > img[src="/logo.png"][alt="Flexweb"]');
    const intro = logo?.parentElement?.nextElementSibling;
    if (intro?.tagName === 'P') {
      // A server-rendered React island must hydrate its original markup first.
      if (!footer.closest('astro-island[ssr]')) intro.after(makeAddress());
      return;
    }
    const directory = footer.querySelector(':scope > nav[aria-label="Footer navigation"] + p');
    const first = directory?.firstChild;
    if (first?.nodeType !== Node.TEXT_NODE || !first.data.includes(postal.streetAddress) ||
      !directory.querySelector('a[href="mailto:contact@flex-web.fr"]')) return;
    directory.before(makeAddress());
    first.remove();
  }
  const afterHydration = () => requestAnimationFrame(() => requestAnimationFrame(update));
  document.addEventListener('astro:hydrate', event => {
    if (event.target.getAttribute?.('component-url')?.includes('/Footer.')) afterHydration();
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afterHydration, {once:true});
  else afterHydration();
}
