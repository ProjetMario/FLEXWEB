import { tsImport } from 'tsx/esm/api';
import { allPages as applicationPages, hubs } from '../../src/data/applications/content.mjs';

// Reuse the actual editorial collections. Adding an editorial page must not
// require copying its URL into a second, increasingly stale notification list.
// Large generated catalogues are intentionally not imported here.
const [{ entrepreneurPages }, { acquisitionPages }, { crmPage, englishPages }, { frenchWebAppGuides }] = await Promise.all([
  tsImport('../../src/data/geo/entrepreneurs.ts', import.meta.url),
  tsImport('../../src/data/geo/acquisition-pages.ts', import.meta.url),
  tsImport('../../src/data/geo/pages.ts', import.meta.url),
  tsImport('../../src/data/geo/web-app-pages.ts', import.meta.url),
]);
const paths = pages => [...new Set(pages.map(page => page.path))];
export const editorialRoutes = paths([
  ...entrepreneurPages, ...acquisitionPages, crmPage, ...englishPages,
  ...frenchWebAppGuides, ...applicationPages,
]);
const geoRoutes = paths([crmPage, ...englishPages, ...frenchWebAppGuides, ...acquisitionPages, ...entrepreneurPages]);
const applications = [...new Set([...paths(applicationPages), ...Object.values(hubs)])];
export const editorialDependencies = new Map([
  ['src/data/geo/entrepreneurs.ts', [...paths(entrepreneurPages), '/creation-site-internet/', '/journal/']],
  ['src/pages/entrepreneurs/[kind]/[slug].astro', paths(entrepreneurPages)],
  ['src/pages/en/[...slug].astro', paths([...englishPages, ...acquisitionPages.filter(page => page.lang === 'en')])],
  ['src/pages/guides/[slug].astro', paths(frenchWebAppGuides)],
  ['src/data/geo/acquisition-pages.ts', paths(acquisitionPages)],
  ['src/data/geo/pages.ts', paths([crmPage, ...englishPages])],
  ['src/data/geo/web-app-pages.ts', paths([...englishPages, ...frenchWebAppGuides])],
  ['src/components/geo/GeoPage.astro', geoRoutes],
  ['src/data/applications/content.mjs', applications],
  ['src/components/applications/ApplicationPage.astro', paths(applicationPages)],
  ['src/components/applications/ApplicationLinks.astro', applications],
  ...['src/pages/applications/[slug].astro', 'src/pages/en/applications/[slug].astro', 'src/pages/de/anwendungen/[...slug].astro', 'src/pages/it/applicazioni/[...slug].astro'].map(file => [file, applications.filter(route => route.startsWith('/' + file.split('/').slice(2, -1).join('/') + '/'))]),
]);
