import assert from 'node:assert/strict';
import {parse} from 'parse5';

export const contactFormAssets = '<link rel="stylesheet" href="/contact-assets/contact-form.css"><script type="module" src="/contact-assets/contact-form.mjs"></script>';

const labels = {
  fr: {
    title: 'Envoyer un message', name: 'Nom (facultatif)', email: 'Votre e-mail', topic: 'Sujet',
    topics: ['Question générale', 'Demande de devis', 'Partenariat', 'Données personnelles'],
    message: 'Votre message', consent: 'J’accepte que Flex-Web me recontacte au sujet de ce message.',
    privacy: 'Confidentialité', button: 'Envoyer mon message', trap: 'Laissez ce champ vide',
    sending: 'Envoi en cours…', success: 'Merci, votre message a bien été reçu.',
    error: 'L’envoi n’a pas pu être confirmé. Votre saisie est conservée. Réessayez ou contactez-nous par téléphone.',
  },
  en: {
    title: 'Send a message', name: 'Name (optional)', email: 'Your email', topic: 'Subject',
    topics: ['General enquiry', 'Request a quote', 'Partnership', 'Personal data'],
    message: 'Your message', consent: 'I agree that Flex-Web may contact me about this message.',
    privacy: 'Privacy policy (in French)', button: 'Send my message', trap: 'Leave this field empty',
    sending: 'Sending…', success: 'Thank you. Your message has been received.',
    error: 'We could not confirm receipt. Your message is still here. Try again or contact us by phone.',
  },
};

export function renderContactForm(lang) {
  const t = labels[lang];
  assert.ok(t, 'Unsupported contact form language');
  const options = ['general', 'quote', 'partnership', 'privacy']
    .map((value, i) => '<option value="' + value + '">' + t.topics[i] + '</option>').join('');
  return `<section class="fw-contact-form" id="contact-form" aria-labelledby="fw-contact-title">
    <h2 id="fw-contact-title">${t.title}</h2>
    <form name="flexweb-contact" method="post" data-netlify="true" data-netlify-honeypot="bot-field" data-flexweb-contact
      data-sending="${t.sending}" data-success="${t.success}" data-error="${t.error}">
      <input type="hidden" name="form-name" value="flexweb-contact">
      <input type="hidden" name="language" value="${lang}">
      <p hidden aria-hidden="true"><label>${t.trap}<input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <label for="fw-contact-name">${t.name}</label>
      <input id="fw-contact-name" name="name" autocomplete="name" maxlength="120">
      <label for="fw-contact-email">${t.email}</label>
      <input id="fw-contact-email" name="email" type="email" autocomplete="email" maxlength="254" required>
      <label for="fw-contact-topic">${t.topic}</label>
      <select id="fw-contact-topic" name="topic">${options}</select>
      <label for="fw-contact-message">${t.message}</label>
      <textarea id="fw-contact-message" name="message" rows="5" maxlength="3000" required></textarea>
      <div class="fw-contact-privacy">
        <label><input type="checkbox" name="consent" value="yes" required><span>${t.consent}</span></label>
        <a href="/privacy/">${t.privacy}</a>
      </div>
      <button type="submit">${t.button}</button>
    </form>
    <p role="status" aria-live="polite" data-contact-status tabindex="-1"></p>
  </section>`;
}

function updateChannels(main, lang) {
  const path = lang === 'fr' ? '/contact/' : '/en/contact/';
  const label = lang === 'fr' ? 'Envoyer un message' : 'Send a message';
  // The archived pages can be received before or after the site-wide replacement.
  return main.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs, text) => {
    const href = attrs.match(/\bhref="([^"]*)"/i)?.[1];
    if (href !== path && !/^mailto:contact@flex-web\.fr(?:\?|$)/i.test(href || '')) return whole;
    const attributes = attrs.replace(/\bhref="[^"]*"/i, 'href="#contact-form"')
      .replace(/\sdata-conversion-(?:event|service)="[^"]*"/gi, '');
    return '<a' + attributes + '>' + label + (text.match(/\s*[↗→]$/)?.[0] || '') + '</a>';
  }).replace(/(<dt\b[^>]*>)E-mail(<\/dt>)/gi, '$1Formulaire$2')
    .replace('Un site internet, une application ou une tâche à automatiser ? Parlez-nous de votre projet, que vous soyez une entreprise ou un particulier.', 'Une question, un partenariat ou un projet de site, d’application ou d’automatisation ? Écrivez-nous en français ou en anglais.')
    .replace(/(?:Email contact@flex-web\.fr|Use the contact form at https:\/\/flex-web\.fr\/en\/contact\/) or call \+33 7 57 83 02 62 to discuss a project with Flex-Web\./, 'Send a message about a project, partnership or personal data using the form, or call +33 7 57 83 02 62.')
    .replace('Businesses and individuals can write their initial request in French or English by email.', 'Businesses and individuals can use the contact form in French or English.');
}

export function insertContactForm(html, lang) {
  const nodes = [];
  function walk(node) {
    if (node.tagName) nodes.push(node);
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html, {sourceCodeLocationInfo: true}));
  const attr = (n, key) => n.attrs.find(a => a.name === key)?.value;
  const one = (list, label) => {
    assert.equal(list.length, 1, label);
    return list[0];
  };
  const root = one(nodes.filter(n => n.tagName === 'html'), 'Contact document');
  assert.equal(attr(root, 'lang'), lang);
  if (nodes.some(n => n.tagName === 'form' && attr(n, 'name') === 'flexweb-contact')) {
    assert.ok(html.includes('/contact-assets/contact-form.mjs') && html.includes('/contact-assets/contact-form.css'));
    return html;
  }
  const main = one(nodes.filter(n => n.tagName === 'main'), 'Contact main').sourceCodeLocation;
  const target = lang === 'fr'
    ? one(nodes.filter(n => (attr(n, 'class') || '').split(/\s+/).includes('contact-quote')), 'French contact panel').sourceCodeLocation.startTag.endOffset
    : one(nodes.filter(n => n.tagName === 'header' && n.parentNode.tagName === 'article'), 'English contact heading').sourceCodeLocation.endOffset;
  const head = one(nodes.filter(n => n.tagName === 'head'), 'Contact head').sourceCodeLocation.endTag.startOffset;
  assert.ok(head < main.startOffset && main.startOffset < target && target < main.endOffset);
  const content = updateChannels(html.slice(main.startOffset, target), lang) + renderContactForm(lang)
    + updateChannels(html.slice(target, main.endOffset), lang);
  return html.slice(0, head) + contactFormAssets + html.slice(head, main.startOffset) + content + html.slice(main.endOffset);
}
