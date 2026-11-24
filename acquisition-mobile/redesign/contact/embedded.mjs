import assert from 'node:assert/strict';
import {contactFormAssets, insertContactForm, renderContactForm} from './form.mjs';

export const receiver = 'https://formulaire-contact--flex-webb.netlify.app';
export function embedContact(html, lang) {
  const url = receiver + (lang === 'fr' ? '/' : '/en/');
  const title = lang === 'fr' ? 'Formulaire de contact' : 'Contact form';
  const open = lang === 'fr' ? 'Ouvrir le formulaire dans une nouvelle page' : 'Open the form in a new page';
  const frame = '<section id="contact-form" style="margin:1.5rem 0;scroll-margin-top:5rem;min-width:0">' +
    '<iframe id="flexweb-contact-frame" title="' + title + '" src="' + url + '" height="690" style="display:block;width:100%;border:0" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
    '<a style="display:inline-block;margin-top:.5rem;font-size:.9rem;text-decoration:underline" href="' + url + '" target="_blank" rel="noopener">' + open + '</a></section>';
  const resize = '<script>addEventListener("message",event=>{const f=document.getElementById("flexweb-contact-frame");if(f&&event.origin==="' + receiver + '"&&event.source===f.contentWindow&&event.data?.type==="flexweb:contact-height"&&Number.isFinite(event.data.height)&&event.data.height>0&&event.data.height<4000)f.height=String(Math.ceil(event.data.height)+3)})</script>';
  const prepared = insertContactForm(html,lang);
  assert.ok(prepared.includes(renderContactForm(lang)) && prepared.includes(contactFormAssets));
  return prepared.replace(renderContactForm(lang),frame + resize).replace(contactFormAssets,'');
}
