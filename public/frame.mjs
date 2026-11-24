// Only dimensions leave the form. The message and email stay in the form POST.
if (parent !== window && document.referrer) {
  const parentOrigin = new URL(document.referrer).origin;
  if (parentOrigin === 'https://flex-web.fr' || parentOrigin === 'https://www.flex-web.fr') {
    const notify = () => parent.postMessage({
      type: 'flexweb:contact-height',
      height: Math.ceil(document.querySelector('main').getBoundingClientRect().height),
    }, parentOrigin);
    new ResizeObserver(notify).observe(document.querySelector('main'));
    notify();
  }
}
