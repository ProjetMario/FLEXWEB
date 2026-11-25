import {eligible} from './policy.mjs';
export const formOrigin='https://formulaire-contact--flex-webb.netlify.app';
export const previewFormOrigin='https://apercu-formulaire-langues--flex-webb.netlify.app';
const assets='<link rel="stylesheet" href="/language-assets/reader.css"><script type="module" src="/language-assets/reader.mjs"></script>';
export function readingMarkup(path,html,preview=false) {
  if(!eligible(path) || !html.includes('</head>') || html.includes('src="/language-assets/reader.mjs"')) return html;
  if(preview && /^\/(?:en\/)?contact\/?$/.test(path)) {
    // Keep the production form, notification hook and source URLs independent from preview traffic.
    html=html.replace(/(<iframe id="flexweb-contact-frame"[^>]*?\bsrc="|<a [^>]*?\bhref="|event\.origin===")https:\/\/formulaire-contact--flex-webb\.netlify\.app(?=["/])/g,
      (_url,start)=>start+previewFormOrigin);
  }
  if(preview) html=html.replace('</body>','<link rel="stylesheet" href="'+previewFormOrigin+'/call-options.css"><script defer src="'+previewFormOrigin+'/call-options.js"></script></body>');
  return html.replace('</head>',assets+'</head>');
}
