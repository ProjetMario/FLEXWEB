/** The artwork is from the public projects already credited on the website. */
export function projectFeature(kind, lang, websiteImage = '/studio-redesign/2savoie-immo.webp') {
  const english = lang === 'en';
  if (kind === 'website') {
    const copy = english
      ? ['Explore 2 Savoie Immo’s website for property searches and valuations.', 'Read the case study (in French)', 'The 2 Savoie Immo home page with its property search']
      : ['Un site immobilier pour rechercher un bien et demander une estimation.', 'Découvrir la réalisation', 'La page d’accueil de 2 Savoie Immo et sa recherche de biens'];
    return '<section class="studio-feature studio-feature--web" aria-labelledby="studio-project-title"><div><h2 id="studio-project-title">2 Savoie Immo</h2><p>'+copy[0]+'</p><a href="/realisations/2savoie-immo/">'+copy[1]+' <span aria-hidden="true">›</span></a></div><div class="studio-image-group"><img width="1440" height="840" loading="lazy" decoding="async" src="'+websiteImage+'" alt="'+copy[2]+'"></div></section>';
  }
  const copy = english
    ? ['Player profiles and club discovery in an iPhone app built by Flex-Web.', 'Explore the case study', 'A player profile in FootNation', 'Club discovery in FootNation']
    : ['Des profils de joueurs et une recherche de clubs dans une application iPhone développée par Flex-Web.', 'Découvrir la réalisation', 'Un profil de joueur dans FootNation', 'La recherche de clubs dans FootNation'];
  const shots = [2,1].map((ordinal,index) => '<img class="studio-phone" width="423" height="920" loading="lazy" decoding="async" src="/images/footnation/'+lang+'-iphone-'+ordinal+'.jpg" alt="'+copy[index+2]+'">').join('');
  const url = english ? '/en/case-studies/footnation/' : '/realisations/footnation/';
  return '<section class="studio-feature studio-feature--app" aria-labelledby="studio-project-title"><div><h2 id="studio-project-title">FootNation</h2><p>'+copy[0]+'</p><a href="'+url+'">'+copy[1]+' <span aria-hidden="true">›</span></a></div><div class="studio-image-group">'+shots+'</div></section>';
}
