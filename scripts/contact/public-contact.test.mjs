import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {transformPublicContact} from './public-contact.mjs';
import {transformPublicDirectory} from './build-public-contact.mjs';

const agency = 'contact@flex-web.fr';
const thirdParty = 'contact-admin@cnpm-mediation-consommation.eu';

test('HTML localisé, JSON-LD, balises meta, rendu serveur et données hydratées', () => {
  const data = {links:[1,[[0,{label:[0,'E-mail'],value:[0,agency],href:[0,'mailto:' + agency],event:[0,'email_click']}]]]};
  const schema = {'@type':'ProfessionalService',url:'https://flex-web.fr/',email:agency,contactPoint:{'@type':'ContactPoint',email:agency}};
  const encoded = JSON.stringify(data).replaceAll('"','&quot;');
  const html = '<html lang="it"><head><meta name="description" content="' + agency + '"><script type="application/ld+json">' +
    JSON.stringify(schema) + '</script></head><body><astro-island props="' + encoded + '"><a class="cta" data-conversion-event="email_click" href="mailto:contact%40flex-web.fr?subject=Test&amp;body=Salve">Scrivere via e-mail</a></astro-island></body></html>';
  const result = transformPublicContact('/projets-sites/suisse/it/exemple/index.html', html);
  assert.doesNotMatch(result, /mailto|contact(?:@|%40)flex-web|email_click/i);
  assert.match(result, /class="cta" data-conversion-event="contact_form_click" href="\/en\/contact\/">Modulo di contatto \(inglese\)/);
  const json = JSON.parse(result.match(/<script[^>]+>(.*?)<\/script>/)[1]);
  assert.deepEqual(json, {'@type':'ProfessionalService',url:'https://flex-web.fr/',contactPoint:{'@type':'ContactPoint',url:'https://flex-web.fr/en/contact/'}});
  const hydrated = JSON.parse(result.match(/props="([^"]*)"/)[1].replaceAll('&quot;','"'));
  assert.deepEqual(hydrated.links[1][0][1],{label:[0,'Modulo di contatto (inglese)'],value:[0,'Modulo di contatto (inglese)'],href:[0,'/en/contact/'],event:[0,'contact_form_click']});
  assert.equal(transformPublicContact('/index.html',result), result);
});

test('les exemples, le médiateur, les événements de tiers et les champs des particuliers restent disponibles', () => {
  const external = '<a href="mailto:' + thirdParty + '" data-conversion-event="email_click">E-mail du médiateur</a>';
  const field = '<input name="email" type="email" placeholder="vous@entreprise.fr">';
  const html = '<html lang="fr"><body><a href="mailto:' + agency + '?subject=Devis">Décrire mon projet par e-mail</a>' + external + field + '</body></html>';
  const out = transformPublicContact('/privacy/index.html',html);
  assert.ok(out.includes(external) && out.includes(field));
  assert.match(out, /href="\/contact\/">Décrire mon projet</);
  const doc = 'Aide : ' + agency + '. Visiteur : info+' + agency + '. Support : contact@flex-web.fr.example.test.';
  assert.match(transformPublicContact('/sample.txt',doc),/info\+contact@flex-web\.fr\. Support : contact@flex-web\.fr\.example\.test/);
});

test('une nouvelle hydratation conserve les CTA sans modifier les messages destinés aux clients', () => {
  const source = 'const link={href:`mailto:' + agency + '?subject=${encodeURIComponent(topic)}`,"data-conversion-event":"email_click"};' +
    'const other={href:`mailto:${lead.email}`,"data-conversion-event":"email_click"};[link,other]';
  const out = transformPublicContact('/_astro/component.js',source);
  assert.doesNotMatch(out, /contact@flex-web\.fr/);
  const [link,other] = runInNewContext(out,{topic:'site',lead:{email:'client@example.test'}});
  assert.equal(link.href, '/contact/');
  assert.equal(link['data-conversion-event'], 'contact_form_click');
  assert.equal(other.href, 'mailto:client@example.test');
  assert.equal(other['data-conversion-event'], 'email_click');
});

test('un ancien bundle React sélectionne le même libellé que le HTML allemand et italien', () => {
  const source = 'const title="Anwendungen (Französisch)";({href:"mailto:' + agency + '",children:"' + agency + '"})';
  const out = transformPublicContact('/_astro/footer.js',source);
  for (const [lang,label] of [['de','Kontaktformular (Englisch)'],['it','Modulo di contatto (inglese)']]) {
    const res = runInNewContext(out,{document:{documentElement:{lang}}});
    assert.equal(res.href, '/en/contact/');
    assert.equal(res.children, label);
  }
});

test('le post-traitement du build est idempotent et préserve fichiers binaires et exemples', async () => {
  const dist = await mkdtemp(join(tmpdir(),'flexweb-public-contact-test-'));
  try {
    await writeFile(join(dist,'llms-full.txt'),'- E-mail : ' + agency + '.');
    await writeFile(join(dist,'contact.json'),JSON.stringify({organization:{email:agency},visitor:{email:'test@example.com'}}));
    await writeFile(join(dist,'image.bin'),Buffer.from([5,6,127,0]));
    assert.deepEqual(await transformPublicDirectory(dist),{files:2,changed:2});
    assert.match(await readFile(join(dist,'llms-full.txt'),'utf8'),/Formulaire de contact : https:\/\/flex-web\.fr\/contact\//);
    assert.deepEqual(JSON.parse(await readFile(join(dist,'contact.json'),'utf8')),{organization:{},visitor:{email:'test@example.com'}});
    assert.deepEqual(await readFile(join(dist,'image.bin')),Buffer.from([5,6,127,0]));
    assert.deepEqual(await transformPublicDirectory(dist),{files:2,changed:0});
  } finally { await rm(dist,{recursive:true,force:true}); }
});

test('the general form, quotes and confirmed enquiries remain separate across archived analytics bundles', () => {
  const chunk = 'let accepts=x=>["quote_click","crm_link_open","appointment_click","email_click","phone_click"].includes(x);[accepts("quote_click"),accepts("contact_form_click"),accepts("generate_lead")]';
  const output = transformPublicContact('/_astro/conversionevents.js',chunk);
  assert.deepEqual(Array.from(runInNewContext(output)),[true,true,false]);
  assert.equal(transformPublicContact('/_astro/conversionevents.js',output),output);
  const specific = '<html lang="fr"><a data-conversion-event="quote_click" href="mailto:' + agency + '">Demander un devis</a></html>';
  assert.match(transformPublicContact('/index.html',specific), /data-conversion-event="quote_click" href="\/contact\/"/);
});

test('legal articles retain an actionable contact outside the hydrated content', () => {
  const source = '<html lang="fr"><main><astro-island><p>Pour exercer vos droits, contactez-nous via ' + agency + '.</p></astro-island></main></html>';
  const output = transformPublicContact('/privacy/index.html',source);
  assert.match(output,/<\/astro-island><p[^>]*><a[^>]*data-legal-contact-form href="\/contact\/"/);
  assert.equal(transformPublicContact('/privacy/index.html',output),output);
});
