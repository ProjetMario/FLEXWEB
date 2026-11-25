// The production site already shares this small branch with its contact forms.
(() => {
  'use strict';
  if (!['flex-web.fr', 'www.flex-web.fr'].includes(location.hostname)) return;
  if (/^\/(?:\.netlify|api|admin|private|crm|projet|portail|espace-projet|espace-client)(?:\/|$)/i.test(location.pathname)) return;

  const number = '+33 7 57 83 02 62';
  const phone = 'tel:+33757830262';
  const phoneLink = 'a[href="' + phone + '"]';
  const forms = 'form.flow-card, form.studio-contact-form, form[data-flexweb-contact], form[action="/api/subscribe"]';
  const candidates = forms + ', a.action[href="' + phone + '"], a[data-conversion-event="quote_click"], a[href*="demarrer"], a[href*="contact"], a[href*="devis"], a[href*="quote"]';
  const agencyDomains = new Set(['flex-web.fr', 'www.flex-web.fr']);
  const demo = /^\/(?:en\/)?(?:demo|demos|maquettes?|prospects?)(?:\/|$)/i.test(location.pathname);
  const translations = { fr: 'Appeler le', en: 'Call', de: 'Anrufen unter', it: 'Chiama il' };
  const language = document.documentElement.lang.slice(0, 2).toLowerCase();
  const pendingIslands = new WeakSet();
  const readyIslands = new WeakSet();

  function phoneNumber() {
    const digits = document.createElement('span');
    digits.className = 'fw-call-number';
    digits.textContent = number;
    return digits;
  }

  function callOption() {
    const option = document.createElement('span');
    option.className = 'fw-call-option';
    const link = document.createElement('a');
    link.href = phone;
    link.dataset.conversionEvent = 'phone_click';
    link.append((translations[language] || translations.fr) + ' ', phoneNumber());
    option.append(link);
    return option;
  }

  function isQuote(link) {
    if (!link.closest('main, article') || link.closest('nav, footer, [role="navigation"], form')) return false;
    let target;
    try { target = new URL(link.getAttribute('href'), location.href); } catch { return false; }
    if (!/^https?:$/.test(target.protocol) || !agencyDomains.has(target.hostname)) return false;
    // A demo's own quote or telephone belongs to the business it showcases.
    if (/^\/(?:demarrer|devis)(?:\/|$)/i.test(target.pathname)) return true;
    if (demo) return false;
    const contact = /^\/(?:en\/)?contact\/?$/.test(target.pathname) ||
      (target.pathname === location.pathname && /^#(?:contact|devis|quote)(?:-form)?$/.test(target.hash));
    return contact && (link.dataset.conversionEvent === 'quote_click' ||
      /\b(?:devis|quote|estimate|angebot|offerte|preventivo)\b/i.test(link.textContent));
  }

  function addOption(el) {
    if (!el.isConnected) return;
    const island = el.closest('astro-island');
    if (island && !readyIslands.has(island)) {
      // Astro can remove ssr before React's scheduled hydration commits.
      if (!island.hasAttribute('ssr') && !pendingIslands.has(island)) {
        pendingIslands.add(island);
        const ready = () => { readyIslands.add(island); visit(island); };
        if (window.requestIdleCallback) window.requestIdleCallback(ready, {timeout:1000});
        else setTimeout(ready, 50);
      }
      return;
    }
    if (el.matches(phoneLink)) {
      if (!demo && el.closest('main, article') && !/\d/.test(el.textContent)) el.append(' ', phoneNumber());
      return;
    }
    if (el.tagName === 'FORM') {
      if (demo || el.querySelector(phoneLink)) return;
      if (el.classList.contains('flow-card') && el.querySelector(':scope > fieldset:disabled')) return;
      if (el.matches('form[action="/api/subscribe"]')) {
        if (!el.nextElementSibling?.matches('.fw-call-option')) el.after(callOption());
      } else {
        el.append(callOption());
      }
      return;
    }
    if (!isQuote(el) || el.parentElement.querySelector(phoneLink)) return;
    const option = callOption();
    if (el.dataset.conversionService) option.firstElementChild.dataset.conversionService = el.dataset.conversionService;
    el.after(option);
  }

  function visit(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches(candidates)) addOption(root);
    root.querySelectorAll(candidates).forEach(addOption);
  }
  function start() {
    visit(document.body);
    new MutationObserver(changes => {
      for (const change of changes) {
        if (change.attributeName === 'disabled' && change.target.matches('fieldset')) visit(change.target.closest('form') || change.target);
        else if (change.type === 'attributes') visit(change.target);
        else change.addedNodes.forEach(visit);
      }
    }).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['ssr','href','disabled']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
