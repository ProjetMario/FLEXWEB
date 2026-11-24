const origin = 'https://flex-web.fr';
const mailbox = String.raw`(?<![\w.%+-])contact(?:@|%40|&#0*64;|&#x0*40;|&commat;|\\u0040)flex-web\.fr(?![\w-]|\.[a-z])`;
const hasMailbox = new RegExp(mailbox, 'i');
export const hasPublicMailbox = text => hasMailbox.test(text);
const embeddedMailto = new RegExp('mailto:' + mailbox + '(?:\\?[^\\s"\x27\x60<>\\)\\]]*)?', 'gi');
const allMailboxes = new RegExp(mailbox, 'gi');
const mailto = new RegExp('^mailto:' + mailbox + '(?:\\?[^#]*)?$', 'i');
const contactLabel = new RegExp('(?:E-?mail|Courriel)\\s*:\\s*' + mailbox, 'gi');
const frenchReference = new RegExp('(?:par (?:e-?mail|courriel) à|par mail à|auprès de|via|à) ' + mailbox, 'gi');
const frenchPrompt = new RegExp('(?:Contactez|Écrivez à) ' + mailbox, 'gi');
const englishPrompt = new RegExp('Email ' + mailbox, 'g');
const labels = {
  fr:{path:'/contact/', label:'Formulaire de contact'},
  en:{path:'/en/contact/', label:'Contact form'},
  de:{path:'/en/contact/', label:'Kontaktformular (Englisch)'},
  it:{path:'/en/contact/', label:'Modulo di contatto (inglese)'},
};
const textExtensions = new Set(['.html','.htm','.txt','.md','.json','.jsonld','.xml','.js','.mjs','.webmanifest']);
const extension = path => path.match(/(\.[a-z0-9]+)$/i)?.[1].toLowerCase() || '';
export const isPublicContactAsset = path => textExtensions.has(extension(path));

function wording(text, contact) {
  if (!hasMailbox.test(text) && !/e-?mail (?:ou|or)/i.test(text)) return text;
  const absolute = origin + contact.path;
  // Limit these rewrites to contact instructions. Visitor fields, order confirmations
  // and descriptions of email-based automation all use the same word for email.
  return text
    .replace(contactLabel, contact.label + ' : ' + absolute)
    .replace(frenchReference, 'via le formulaire ' + absolute)
    .replace(frenchPrompt, 'Utilisez le formulaire ' + absolute)
    .replace(englishPrompt, 'Use the contact form at ' + absolute)
    .replace(/(contactez-nous|contactez Flex-Web|échangeons|décrivez votre projet|décrire leur idée) par e-?mail ou (?:par )?téléphone/gi, '$1 via le formulaire ou par téléphone')
    .replace(/(contact Flex-Web|describe your project|describe their idea) by e-?mail or (?:by )?(?:telephone|phone)/gi, '$1 via the contact form or by phone')
    .replace(/Businesses and individuals: email or telephone\./g, 'Businesses and individuals can use the contact form or call.')
    .replace(embeddedMailto, absolute)
    .replace(allMailboxes, absolute);
}

function linkLabel(text, contact) {
  if (/<[a-z/][^>]*>/i.test(text)) return text.split(/(<[^>]*>)/).map(part => part.startsWith('<') ? part : linkLabel(part, contact)).join('');
  const plain = text.trim();
  if (hasMailbox.test(plain) || /^(?:e-?mail(?: Flex-Web)?|E-Mail schreiben|Scrivere via e-mail)(?:\s*[→↗])?$/i.test(plain))
    return contact.label + (plain.match(/\s*[→↗]$/)?.[0] || '');
  return text.replace(/Décrire mon projet par e-?mail/gi, 'Décrire mon projet')
    .replace(/Écrire à Flex-Web/gi,'Contacter Flex-Web')
    .replace(/(?:Send an email|Email us|Send us an email|Send an enquiry by email)/gi,'Open the contact form')
    .replace(/Email about a website/gi,'Discuss a website').replace(/Email about an app/gi,'Discuss an app')
    .replace(/Describe your project by e-?mail/gi,'Describe your project')
    .replace(/per E-Mail kontaktieren/g, 'über das Kontaktformular erreichen')
    .replace(/per E-Mail besprechen/g, 'über das Formular besprechen')
    .replace(/via e-mail/gi, 'tramite il modulo')
    .replace(/ (?:par|by) e-?mail/gi, '');
}

const escapeAttribute = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const decodeAttribute = s => s.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&#x27;',"'")
  .replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');

function transformData(value, contact) {
  if (typeof value === 'string') return mailto.test(value) ? contact.path : wording(value, contact);
  if (Array.isArray(value)) return value.map(item => transformData(item, contact));
  if (!value || typeof value !== 'object') return value;
  // Astro serializes each prop as [type, value]. Preserve that representation
  // for the React render that follows hydration.
  const unwrap = item => Array.isArray(item) && item[0] === 0 ? item[1] : item;
  const wrap = (item, result) => Array.isArray(item) ? [0,result] : result;
  const ownLink = ['href','url'].some(key => typeof unwrap(value[key]) === 'string' && mailto.test(unwrap(value[key])));
  const result = {};
  for (const [key,item] of Object.entries(value)) {
    const plain = unwrap(item);
    if (key.toLowerCase() === 'email' && typeof plain === 'string' && hasMailbox.test(plain)) {
      if (value['@type'] === 'ContactPoint' && !value.url) result.url = origin + contact.path;
      continue;
    }
    if (ownLink && key === 'event' && plain === 'email_click') result[key] = wrap(item, 'contact_form_click');
    else if (ownLink && ['value','label','text'].includes(key) && typeof plain === 'string') result[key] = wrap(item, linkLabel(plain, contact));
    else result[key] = transformData(item, contact);
  }
  return result;
}

function html(text, contact) {
  const output = text.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole,attrs,body) => {
    if (!hasMailbox.test(body)) return whole;
    if (/type\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attrs))
      return '<script' + attrs + '>' + JSON.stringify(transformData(JSON.parse(body), contact)).replaceAll('<','\\u003c') + '</script>';
    return '<script' + attrs + '>' + javascript(body, contact) + '</script>';
  }).replace(/\bprops="([^"]*)"/g, (whole, encoded) => {
    if (!hasMailbox.test(encoded)) return whole;
    return 'props="' + escapeAttribute(JSON.stringify(transformData(JSON.parse(decodeAttribute(encoded)), contact))) + '"';
  }).replace(/(<a\b[^>]*?\shref\s*=\s*)(["'])(mailto:[^"']*)\2([^>]*>)([\s\S]*?)<\/a>/gi,
    (whole,prefix,quote,href,rest,label) => {
      if (!mailto.test(decodeAttribute(href))) return whole;
      const tag = (prefix + quote + contact.path + quote + rest)
        .replace(/(data-conversion-event\s*=\s*["'])email_click/gi, '$1contact_form_click')
        .replace(/((?:aria-label|title)=)(["'])([^"']*)\2/gi, (_,name,q,v) => name + q + linkLabel(v, contact) + q);
      return tag + linkLabel(label, contact) + '</a>';
    });
  return wording(output, contact)
    .replace(/(contactez-nous|contacter Flex-Web) par (<a\b[^>]*href="\/contact\/"[^>]*>)(Formulaire de contact)/gi,'$1 via le $2formulaire de contact')
    .replace(/Oppure scriva a (<a\b[^>]*href="\/en\/contact\/"[^>]*>)Modulo di contatto/gi,'In alternativa, utilizzi il $1modulo di contatto');
}

function javascript(text, contact) {
  // Historically shipped React chunks remain linked from archived static pages.
  // Only owned literal mailto URLs are rewritten. Expressions such as
  // mailto:${lead.email} addressed to an actual customer must stay operational.
  const quotedLink = new RegExp('(["\x27\x60])mailto:' + mailbox + '(?:\\?[^"\x27\x60]*)?\\1', 'gi');
  let result = text.replace(/a\[href="mailto:contact@flex-web\.fr"\]/gi, 'a[href="/en/contact/"]');
  // The old shared React footer chooses German or Italian while hydrating.
  result = result.replace(/href:\s*["']mailto:contact@flex-web\.fr["'],\s*children:\s*["']contact@flex-web\.fr["']/gi,
    (whole) => text.includes('Anwendungen (Französisch)') ? 'href:"/en/contact/",children:(document.documentElement.lang==="de"?"Kontaktformular (Englisch)":"Modulo di contatto (inglese)")' : whole);
  result = result.replace(quotedLink, '"__FLEXWEB_PUBLIC_CONTACT_FORM__"')
    .replace(/children:\s*["']contact@flex-web\.fr["']/gi, 'children:' + JSON.stringify(contact.label))
    .replace(/("__FLEXWEB_PUBLIC_CONTACT_FORM__"[^{}]*?["']data-conversion-event["']:\s*["'])email_click(["'])/g,'$1contact_form_click$2')
    .replace(/(["']data-conversion-event["']:\s*["'])email_click(["'][^{}]*?"__FLEXWEB_PUBLIC_CONTACT_FORM__")/g,'$1contact_form_click$2')
    .replaceAll('"__FLEXWEB_PUBLIC_CONTACT_FORM__"', JSON.stringify(contact.path))
    .replace(/Décrire mon projet par e-mail/g,'Décrire mon projet')
    .replace(/écrivez-nous à /g,'utilisez le ');
  return wording(result, contact);
}

export function transformPublicContact(path, text) {
  if (!isPublicContactAsset(path)) return text;
  const ext = extension(path);
  // Both analytics layers in historical Astro bundles validate the event before
  // sending it. Preserve their existing consent and confirmed-lead checks.
  if (['.js','.mjs','.html','.htm'].includes(ext) && text.includes('email_click')) {
    text = text.replace(/\["quote_click",(?:\s*"form_start",)?\s*"crm_link_open",\s*"appointment_click",\s*"email_click",\s*"phone_click"\]\.includes/g,
      list => list.replace('"email_click",','"email_click","contact_form_click",'));
  }
  if (!hasMailbox.test(text)) return text;
  const lang = ext === '.html' || ext === '.htm' ? text.match(/<html\b[^>]*?\slang=["'](fr|en|de|it)(?:-[\w-]+)?["']/i)?.[1] : undefined;
  const contact = labels[(lang || path.match(/^\/?(en|de|it)\//)?.[1] || 'fr').toLowerCase()];
  if (ext === '.html' || ext === '.htm') {
    let result = html(text, contact);
    // These archived legal pages render paragraphs as plain React strings.
    // Keep a usable form link next to the legal article after hydration as well.
    if (/^\/?(?:mentions-legales|privacy)\/index\.html$/i.test(path) && !result.includes('data-legal-contact-form'))
      result = result.replace('</main>', '<p class="mx-auto max-w-7xl px-4 py-4"><a class="underline" data-legal-contact-form href="/contact/">Contacter Flex-Web via le formulaire</a></p></main>');
    return result;
  }
  if (ext === '.js' || ext === '.mjs') return javascript(text, contact);
  if (['.json','.jsonld','.webmanifest'].includes(ext)) return JSON.stringify(transformData(JSON.parse(text), contact)) + '\n';
  return wording(text, contact);
}
