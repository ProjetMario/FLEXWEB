import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
// Netlify query rules match complete sets of parameter names.
const legacyRules = ['application', 'app'].flatMap(service =>
  [' offre=:offre utm_source=:source', ' utm_source=:source', ' offre=:offre', ''].map(parameters =>
    `/demarrer/ service=${service}${parameters} /demarrer/application/ 200!`
  )
).join('\n') + '\n';
const legacyScript = `<script>(() => {
  const url = new URL(location.href);
  const service = (url.searchParams.get('service') || '').toLowerCase();
  if (service === 'application' || service === 'app') {
    url.pathname = '/demarrer/application/';
    location.replace(url.href);
  }
})();</script>`;

function replaceOnce(text, original, replacement) {
  const start = text.indexOf(original);
  if (start === -1 || text.indexOf(original, start + original.length) !== -1) {
    throw new Error('Le formulaire de production a changé. Expression attendue une fois : ' + original);
  }
  return text.slice(0, start) + replacement + text.slice(start + original.length);
}

function dataModule(source) {
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

// Render the exact same component sent to the browser, with the local server React runtime.
async function renderForm(source, baseline, prefix) {
  const imports = source.match(/^import\{j as e\}from"\.\/jsx-runtime\.[\w-]+\.js";import\{r as a\}from"\.\/index\.[\w-]+\.js";(import\{[^}]+\}from)"\.\/(api\.[\w-]+\.js)";/);
  if (!imports) throw new Error('Imports du formulaire de production non reconnus');
  const jsx = pathToFileURL(require.resolve('react/jsx-runtime')).href;
  const react = pathToFileURL(require.resolve('react')).href;
  const api = dataModule(await readFile(join(baseline, '_astro', imports[2]), 'utf8'));
  const entry = source.slice(imports[0].length);
  const server = `import e from "${jsx}";import a from "${react}";${imports[1]}"${api}";${entry}`;
  const { default: Form } = await import(dataModule(server));
  return renderToString(React.createElement(Form), { identifierPrefix: prefix });
}

export async function buildQuote({ baseline, output }) {
  const html = await readFile(join(baseline, 'demarrer/index.html'), 'utf8');
  const island = html.match(/(<astro-island\b[^>]*component-url="\/_astro\/(StartProject\.[\w-]+\.js)"[^>]*>)([\s\S]*?)<!--astro:end--><\/astro-island>/);
  if (!island || !/<meta name="robots" content="[^"]*noindex/.test(html)) {
    throw new Error('Îlot Astro ou directive noindex manquants dans le formulaire publié');
  }
  const prefix = island[1].match(/\bprefix="([^"]+)"/)?.[1];
  if (!prefix) throw new Error('Préfixe React du formulaire introuvable');
  let source = await readFile(join(baseline, '_astro', island[2]), 'utf8');
  source = replaceOnce(source, '[i,I]=a.useState("site")', '[i,I]=a.useState("application")');
  source = replaceOnce(source,
    'n=(t.get("service")||"").toLowerCase(),d=["automation","ia","seo"].includes(n)?"automation":["application","app"].includes(n)?"application":"site"',
    'd="application"');
  source = replaceOnce(source, 'className:"flow-price",children:r?"Sur devis":',
    'className:"flow-price",children:i==="application"?`À partir de ${f(o.setupCents)} TTC`:r?"Sur devis":');

  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  const moduleName = `StartApplication.${hash}.js`;
  const markup = await renderForm(source, baseline, prefix);
  const opening = replaceOnce(island[1], island[2], moduleName);
  const rendered = replaceOnce(html, island[0], opening + markup + '<!--astro:end--></astro-island>');
  const page = replaceOnce(rendered, '<title>Démarrer mon projet — FLEX-WEB</title>',
    '<title>Demander un devis pour une application mobile — Flex-Web</title>');

  let redirects;
  try {
    redirects = await readFile(join(output, '_redirects'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    redirects = await readFile(join(baseline, '_redirects'), 'utf8');
  }
  if (!redirects.startsWith(legacyRules)) redirects = legacyRules + redirects;
  const files = new Map([
    ['demarrer/application/index.html', page],
    ['demarrer/index.html', replaceOnce(html, '<head>', '<head>' + legacyScript)],
    ['_astro/' + moduleName, source],
    ['_redirects', redirects],
  ]);
  for (const [name, contents] of files) {
    await mkdir(dirname(join(output, name)), { recursive: true });
    await writeFile(join(output, name), contents);
  }
  return [...files.keys()];
}
