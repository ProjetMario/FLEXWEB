import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mobilePages, updated} from '../src/data/mobile.mjs';
import {baseline, collect, filePath, get, linkPages, output, put, snapshot} from './baseline.mjs';
import {buildQuote} from './quote.mjs';

export const origin = 'https://flex-web.fr';
export const pages = [...mobilePages,
  {lang:'fr', path:'/realisations/footnation/', title:'FootNation sur iPhone et iPad'},
  {lang:'en', path:'/en/case-studies/footnation/', title:'FootNation for iPhone and iPad'}
];

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"','&quot;');
export const locations = xml => Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g),m=>m[1]);
function updateSitemap(xml, changed) {
  const expected = new Set(locations(xml));
  assert.equal(expected.size, locations(xml).length);
  assert.ok(xml.includes('<urlset ') && xml.includes('</urlset>'));
  const modified = xml.replace(/<url>[\s\S]*?<\/url>/g, entry => {
    const route = new URL(locations(entry)[0]).pathname;
    if (!changed.has(route)) return entry;
    if (/<lastmod>/.test(entry)) return entry.replace(/<lastmod>[^<]+/, '<lastmod>' + updated);
    return entry.replace('</loc>', '</loc>\n    <lastmod>' + updated + '</lastmod>');
  });
  const additions = pages.filter(p => !expected.has(origin + p.path))
    .map(p => '  <url><loc>' + origin + p.path + '</loc><lastmod>' + updated + '</lastmod></url>\n').join('');
  const result = modified.replace('</urlset>', additions + '</urlset>');
  const urls = locations(result);
  assert.equal(urls.length, new Set(urls).size);
  assert.deepEqual(new Set(urls), new Set([...expected,...pages.map(p=>origin+p.path)]));
  return result;
}

const page = id => mobilePages.find(p => p.id === id && p.lang === 'fr');
const proof = {path:'/realisations/footnation/', title:'Voir les écrans de FootNation sur iPhone et iPad'};
function contextBlock(route) {
  const isLocal = route.startsWith('/creation-application-mobile-');
  const links = route === '/pricing/' ? [page('budget'), page('individuals'), proof]
    : route === '/application-metier-sur-mesure/' ? [page('businesses'), page('compare'), proof]
    : route === '/journal/' ? [proof, page('compare'), page('budget')]
    : [page('hub'), page('budget'), proof];
  const heading = isLocal ? 'Préparer votre projet mobile' : route === '/journal/' ? 'Guides et réalisation mobile' : 'Préparer un devis pour une application';
  const descr = route === '/pricing/' ? 'Pour une première version iOS et Android, le budget démarre à 1 990 € TTC. Le devis détaille les fonctions, les frais tiers et la maintenance éventuelle.'
    : route === '/application-metier-sur-mesure/' ? 'Pour un outil interne, décrivez une tâche de terrain, les personnes qui la réalisent et le logiciel auquel elle doit être reliée.'
    : route === '/journal/' ? 'Découvrez un projet publié et les critères qui permettent de choisir une plateforme et de chiffrer sa première version.'
    : 'Vous hésitez entre une application installée et un service web ? Comparez le périmètre, le budget et un exemple publié avant de demander un devis.';
  return '<section aria-labelledby="mobile-project-resources" class="mx-auto max-w-5xl px-6 py-10"><h2 id="mobile-project-resources" class="text-2xl font-semibold">' + heading + '</h2><p class="mt-3">' + descr + '</p><ul class="mt-3">' + links.map(l=>'<li><a class="underline" href="'+l.path+'">'+escape(l.title)+'</a></li>').join('') + '</ul></section>';
}
function updateText(text,name) {
  const start = 'Pour une application mobile simple, le tarif de départ est de 1 990 € TTC pour iOS et Android ensemble. Le devis précise les écrans, les fonctions, les délais, les frais tiers et la maintenance éventuelle.';
  const summary = '\n## Développement mobile pour entreprises et particuliers\n' +
    'Informations mobiles révisées le ' + updated + '. Flex-Web, marque de Fleximmo à Voglans en France, accompagne les entreprises et les particuliers en France, en Suisse romande, en Belgique francophone et à distance pour les autres projets francophones selon le devis. Les échanges se font en français ou en anglais.\n\n' +
    start + ' La publication en boutique reste soumise à la décision de chaque plateforme.\n\n' +
    'Réalisation vérifiable : FootNation, publiée pour iPhone et iPad par FLEX IMMO. La fiche Apple atteste la présence sur cette boutique. Le budget du projet est privé.\n' +
    '- [FootNation sur l’App Store](https://apps.apple.com/fr/app/footnation/id6803557829)\n' +
    (name === '/llms-full.txt' ? pages : pages.filter(p=>p.lang==='fr' && ['hub','businesses','individuals','budget','suisse','belgique'].includes(p.id) || p.path === proof.path)).map(p=>'- ['+p.title+']('+origin+p.path+')').join('\n') + '\n';
  return text.replace('- Automatisation IA sur mesure et applications : devis personnalisé.','- Automatisation IA sur mesure : devis personnalisé.')
    .replace('Date de mise à jour : 21 octobre 2026','Date de dernière révision de la partie applications mobiles : '+updated)
    .trimEnd() + '\n' + summary;
}
export async function assemble() {
  const {manifest} = await snapshot();
  await collect(manifest);
  for (const p of pages) assert.ok((await get(output,filePath(p.path))).length, p.path);
  for (const route of linkPages) {
    const path = filePath(route);
    const html = (await get(baseline,path)).toString();
    const pos = html.lastIndexOf('</main>');
    assert.ok(pos !== -1 && html.indexOf('id="mobile-project-resources"') < 0, path);
    await put(output,path,html.slice(0,pos)+contextBlock(route)+html.slice(pos));
  }
  for (const file of ['/llms.txt','/llms-full.txt','/ai-overview.txt']) {
    await put(output,file,updateText((await get(baseline,file)).toString(),file));
  }
  const xml = await readFile(baseline+'/sitemap.xml','utf8');
  const result = updateSitemap(xml,new Set([...pages.map(p=>p.path),...linkPages]));
  await put(output,'/sitemap.xml',result);
  await buildQuote({baseline,output});
  console.log('Sitemap avant/après :', locations(xml).length, locations(result).length, 'URL');
}
if (process.argv[1]?.endsWith('/assemble.mjs')) await assemble();
