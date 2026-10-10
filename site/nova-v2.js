'use strict';
(() => {
  // N'activer le drone qu'après validation de sa disponibilité réelle par Hugo.
  const config = Object.freeze({ droneEnabled: false });
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('navigation');
  const form = document.getElementById('devis-form');
  const service = document.getElementById('prestation');
  const status = document.getElementById('form-status');
  const notice = document.getElementById('preview-notice');
  const submit = form?.querySelector('button[type="submit"]');
  const submitLabel = submit?.querySelector('.submit-label');
  const localPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1', ''].includes(location.hostname) || document.documentElement.dataset.preview === 'true';
  function closeMenu(restoreFocus = false) {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    if (restoreFocus) menu.focus();
  }
  menu?.addEventListener('click', () => {
    const opening = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(opening));
    nav?.classList.toggle('open', opening);
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (nav?.classList.contains('open') && event.target instanceof Node && !nav.contains(event.target) && !menu?.contains(event.target)) closeMenu();
  });
  window.matchMedia('(min-width:921px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
    if (service && [...service.options].some(option => option.value === link.dataset.service)) {
      service.value = link.dataset.service;
      service.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }));
  const legacyAnchors = { '#expertises': '#curage', '#contact': '#devis', '#realisations': '#curage' };
  if (legacyAnchors[location.hash]) {
    const target = legacyAnchors[location.hash];
    history.replaceState(null, '', target);
    document.querySelector(target)?.scrollIntoView();
  }
  // Conserver le routage d'authentification présent sur le site d'origine.
  if (/(?:^#|&)(?:invite_token|recovery_token|confirmation_token|access_token)=/.test(location.hash)) {
    location.replace('/admin/' + location.hash);
    return;
  }
  if (config.droneEnabled) {
    const template = document.getElementById('drone-template');
    if (template instanceof HTMLTemplateElement) document.getElementById('drone-slot')?.append(template.content.cloneNode(true));
  }
  document.querySelector('a[href="#donnees"]')?.addEventListener('click', () => {
    const details = document.getElementById('donnees');
    if (details instanceof HTMLDetailsElement) details.open = true;
  });
  if (notice) notice.hidden = !localPreview;
  if (localPreview && submitLabel) submitLabel.textContent = 'Aperçu — envoi après publication';
  if (!form || !status || !submit || !submitLabel) return;
  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    if (localPreview) {
      setStatus('Cette maquette ne transmet aucune demande. Pour contacter Hugo maintenant : 07 84 97 11 52 ou 73novahabitat@gmail.com.', 'info');
      status.focus();
      return;
    }
    if (!form.reportValidity()) return;
    const telephone = form.elements.namedItem('telephone');
    if (telephone instanceof HTMLInputElement && telephone.value.replace(/\D/g, '').length < 6) {
      telephone.setCustomValidity('Indiquez un numéro permettant de vous rappeler.');
      telephone.reportValidity();
      telephone.addEventListener('input', () => telephone.setCustomValidity(''), { once: true });
      return;
    }
    const body = new URLSearchParams();
    for (const [name, value] of new FormData(form)) if (typeof value === 'string') body.append(name, value.trim());
    submitting = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    submitLabel.textContent = 'Envoi en cours…';
    setStatus('', 'pending');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/nova-forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(), signal: controller.signal, credentials: 'same-origin'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      setStatus('Merci, votre demande a été enregistrée. Hugo reviendra vers vous pour préciser votre projet.', 'success');
      status.focus();
    } catch (error) {
      setStatus('L’envoi n’a pas pu être confirmé. Vos informations sont conservées dans ce formulaire. Contactez Hugo au 07 84 97 11 52 ou à 73novahabitat@gmail.com.', 'error');
      status.focus();
    } finally {
      window.clearTimeout(timer);
      submitting = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
      submitLabel.textContent = 'Envoyer ma demande';
    }
  });
})();
