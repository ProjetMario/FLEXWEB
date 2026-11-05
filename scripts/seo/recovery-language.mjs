import {candidates,locationLanguage} from '../../src/lib/seo-expansion/fr-ch.mjs';

// Primary Swiss project URLs use the locality's language rather than a URL
// prefix. Derive it from the same verified source as the Astro renderer.
let projectLanguages;
export function expectedLanguage(route){
 if(route.startsWith('/projets-sites/')){
  projectLanguages??=new Map(candidates().map(({path,location})=>[path,locationLanguage(location)]));
  const projectLanguage=projectLanguages.get(route);
  if(projectLanguage)return projectLanguage;
 }
 return route.startsWith('/en/')?'en':route.startsWith('/de/')?'de':route.startsWith('/it/')?'it':'fr';
}
