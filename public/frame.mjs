// The parent selects a language. No field contents leave the frame through this channel.
const officialParent = origin => ['https://flex-web.fr', 'https://www.flex-web.fr'].includes(origin) ||
  /^https:\/\/[a-f0-9]{24}--flex-webb\.netlify\.app$/.test(origin);
const parentOrigin = document.referrer && new URL(document.referrer).origin;
if (parent !== window && officialParent(parentOrigin)) {
  const send = data => parent.postMessage(data, parentOrigin);
  const main = document.querySelector('main');
  new ResizeObserver(() => send({type:'flexweb:contact-height', height:Math.ceil(main.getBoundingClientRect().height)})).observe(main);
  const initial = document.documentElement.lang;
  const copies = new Map([[initial, document.cloneNode(true)]]);
  const form = main.querySelector('form[data-flexweb-contact]');
  // Signal only that a draft exists, including when focus has returned to the parent.
  form.addEventListener('input',()=>send({type:'flexweb:contact-edited'}),{once:true});
  form.addEventListener('change',()=>send({type:'flexweb:contact-edited'}),{once:true});
  const selectors = ['h2','label[for]','.fw-contact-privacy span','.fw-contact-privacy a',
    'select option','button[type="submit"]','.fw-contact-call'];
  let latest = 0;
  async function choose(language) {
    const ticket = ++latest;
    if (document.documentElement.lang === language) return;
    if (!copies.has(language)) {
      const response = await fetch(language === 'en' ? '/en/' : '/', {credentials:'same-origin'});
      if (!response.ok) return;
      const localized = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (localized.documentElement.lang !== language || !localized.querySelector('form[data-flexweb-contact]')) return;
      copies.set(language, localized);
    }
    if (ticket !== latest) return;
    const copy = copies.get(language), other = copy.querySelector('form');
    const status = main.querySelector('[data-contact-status]');
    const state = ['success','error'].find(key => form.dataset[key] === status.textContent);
    for (const selector of selectors) {
      const translated = copy.querySelectorAll(selector);
      main.querySelectorAll(selector).forEach((el,i) => {
        if (translated[i] && (!el.matches('button') || !form.hasAttribute('aria-busy'))) el.textContent = translated[i].textContent;
      });
    }
    for (const key of ['sending','error','success']) form.dataset[key] = other.dataset[key];
    if (state) status.textContent = form.dataset[state];
    const button = form.querySelector('button[type="submit"]');
    button.dataset.idle = other.querySelector('button[type="submit"]').textContent;
    if (form.hasAttribute('aria-busy')) button.textContent = form.dataset.sending;
    const field = form.elements.namedItem('language');
    field.defaultValue = field.value = language;
    form.setAttribute('action', other.getAttribute('action'));
    document.title = copy.title;
    document.documentElement.lang = language;
  }
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.type !== 'flexweb:reader-language') return;
    if (['en','fr'].includes(event.data.language)) choose(event.data.language).catch(() => {});
  });
  send({type:'flexweb:contact-ready'});
}
