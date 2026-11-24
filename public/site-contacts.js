// This file is shared by the existing static pages on the main domain.
(() => {
  'use strict';
  if (!['flex-web.fr','www.flex-web.fr'].includes(location.hostname)) return;
  const receiver = 'https://formulaire-contact--flex-webb.netlify.app';
  const language = (document.documentElement.lang || 'fr').slice(0, 2);
  const copy = {
    fr: ['Formulaire de contact', 'Formulaire', 'Ouvrir le formulaire dans une nouvelle page'],
    en: ['Contact form', 'Form', 'Open the form in a new page'],
    de: ['Kontaktformular (Englisch)', 'Formular', 'Formular in einem neuen Fenster öffnen'],
    it: ['Modulo di contatto (inglese)', 'Modulo', 'Apri il modulo in una nuova pagina'],
  }[language] || ['Formulaire de contact', 'Formulaire', 'Ouvrir le formulaire dans une nouvelle page'];
  const fr = language === 'fr';
  const contact = fr ? '/contact/' : '/en/contact/';
  const isContact = /^\/(en\/)?contact(?:\/index\.html|\/?)$/.test(location.pathname);
  const formURL = receiver + (fr ? '/' : '/en/');
  const mediator = 'https://www.medconsodev.eu/mediation-consommation-demande.php';
  const address = /[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,63}\b/gi;
  // Preserve data entered by visitors and messages in authenticated workspaces.
  const privatePage = /^\/(?:admin|crm|projet|portail|espace-client)(?:\/|$)/i.test(location.pathname);
  const isAgency = email => email.toLowerCase().endsWith('@flex-web.fr');
  function destination(email) {
    if (isAgency(email)) return {href:isContact ? '#contact-form' : contact, label:copy[0]};
    if (privatePage) return null;
    if (/@(?:cnpm-mediation-consommation|medconsodev)\.eu$/i.test(email)) {
      return {href:mediator, label:'formulaire du médiateur'};
    }
    // Other parties keep their own destination. Never forward their enquiries to Flex-Web.
    return {href:null, label:fr ? 'adresse e-mail' : 'email address'};
  }
  function replaceText(value) {
    return value.replace(address, email => destination(email)?.label ?? email);
  }
  function reviseLink(link) {
    const href = link.getAttribute('href') || '';
    if (!/^mailto:/i.test(href)) return;
    let decoded;
    try { decoded = decodeURIComponent(href.slice(7).split('?')[0]); } catch { return; }
    const email = decoded.match(address)?.[0];
    if (!email) return;
    const target = destination(email);
    if (!target) return;
    if (target.href) link.setAttribute('href', target.href);
    else link.removeAttribute('href');
    if (link.dataset.conversionEvent === 'email_click') link.dataset.conversionEvent = 'contact_form_click';
    const label = link.textContent.trim();
    if (/^(?:e-?mail(?: Flex-Web)?|courriel|send an email|email us|scrivere via e-mail|e-mail schreiben)(?:\s*[→↗])?$/i.test(label)) {
      link.textContent = target.label;
    } else {
      for (const child of link.childNodes) if (child.nodeType === Node.TEXT_NODE) {
        child.nodeValue = replaceText(child.nodeValue).replace(/ par e-?mail| by e-?mail/gi, '');
      }
    }
    if (link.parentElement?.tagName === 'DD') {
      const term = link.parentElement.previousElementSibling;
      if (term?.tagName === 'DT' && /^(?:e-?mail|courriel)$/i.test(term.textContent.trim())) term.textContent = copy[1];
    }
  }
  function reviseText(node) {
    const text = node.nodeValue;
    if (!text?.includes('@')) return;
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,noscript,textarea,template,input,[contenteditable]')) return;
    const matches = [...text.matchAll(address)].filter(match => destination(match[0]));
    if (!matches.length) return;
    if (parent.closest('a,button,option,title')) {
      node.nodeValue = replaceText(text);
      return;
    }
    const fragment = document.createDocumentFragment();
    let start = 0;
    for (const match of matches) {
      const target = destination(match[0]);
      fragment.append(text.slice(start, match.index).replace(/(?:e-?mail|courriel)\s*:\s*$/i, ''));
      if (target.href) {
        const link = document.createElement('a');
        link.href = target.href;
        link.textContent = target.label;
        fragment.append(link);
      } else fragment.append(target.label);
      start = match.index + match[0].length;
    }
    fragment.append(text.slice(start));
    node.replaceWith(fragment);
  }
  function attributes(el) {
    if (el.tagName === 'A') reviseLink(el);
    for (const name of ['title','aria-label','alt','placeholder','content']) {
      const value = el.getAttribute(name);
      if (value?.includes('@') && replaceText(value) !== value) el.setAttribute(name, replaceText(value));
    }
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) { reviseText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    attributes(node);
    node.querySelectorAll('a[href^="mailto:" i],[title],[aria-label],[alt],[placeholder],meta[content]').forEach(attributes);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.includes('@')) texts.push(walker.currentNode);
    texts.forEach(reviseText);
  }
  function embed() {
    if (!isContact || document.querySelector('#contact-form, form[data-flexweb-contact]')) return;
    const panel = document.querySelector('.contact-quote');
    const heading = document.querySelector('main article > header');
    if (!panel && !heading) return;
    const section = document.createElement('section');
    section.id = 'contact-form';
    section.style.cssText = 'margin:1.5rem 0;scroll-margin-top:5rem;min-width:0';
    const frame = document.createElement('iframe');
    frame.src = formURL;
    frame.title = copy[0];
    frame.height = '690';
    frame.style.cssText = 'display:block;width:100%;border:0';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const fallback = document.createElement('a');
    fallback.href = formURL;
    fallback.textContent = copy[2];
    fallback.target = '_blank';
    fallback.rel = 'noopener';
    fallback.style.cssText = 'display:inline-block;margin-top:.5rem;font-size:.9rem;text-decoration:underline';
    section.append(frame, fallback);
    if (panel) panel.prepend(section); else heading.after(section);
    window.addEventListener('message', event => {
      if (event.origin !== receiver || event.source !== frame.contentWindow || event.data?.type !== 'flexweb:contact-height') return;
      const height = event.data.height;
      if (Number.isFinite(height) && height > 0 && height < 4000) frame.height = String(Math.ceil(height) + 3);
    });
  }
  function start() {
    embed();
    visit(document.documentElement);
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'attributes') attributes(change.target);
        else if (change.type === 'characterData') reviseText(change.target);
        else change.addedNodes.forEach(visit);
      }
      if (isContact) embed();
    });
    observer.observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true,
      attributeFilter:['href','title','aria-label','alt','placeholder','content']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
