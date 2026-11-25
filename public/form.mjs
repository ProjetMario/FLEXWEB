for (const form of document.querySelectorAll('form[data-flexweb-contact]')) {
  const status = form.closest('.fw-contact-form').querySelector('[data-contact-status]');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const payload = new URLSearchParams(new FormData(form));
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = form.dataset.sending;
    form.setAttribute('aria-busy', 'true');
    status.textContent = '';
    status.removeAttribute('data-error');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(location.pathname, {
        method: 'POST',
        signal: controller.signal,
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: payload.toString(),
      });
      if (!response.ok) throw new Error('Form submission failed');
      // A preview or local host can serve its normal page for an unhandled POST.
      if ((response.headers.get('content-type') || '').includes('text/html')) {
        const returned = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (returned.querySelector('form[data-flexweb-contact], link[rel="canonical"][href^="https://flex-web.fr"]')) {
          throw new Error('Form submission unconfirmed');
        }
      }
      form.reset();
      form.hidden = true;
      status.textContent = form.dataset.success;
    } catch {
      status.setAttribute('data-error', '');
      status.textContent = form.dataset.error;
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
      button.disabled = false;
      button.textContent = button.dataset.idle || originalLabel;
      status.focus();
    }
  });
}
