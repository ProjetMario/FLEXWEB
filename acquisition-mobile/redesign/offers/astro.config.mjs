import {defineConfig} from 'astro/config';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  outDir: fileURLToPath(new URL('../../.release/redesign/offers/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../../.release/redesign/offers-cache/', import.meta.url)),
  build: {format: 'directory', inlineStylesheets: 'always'},
  site: 'https://flex-web.fr',
  trailingSlash: 'always',
  devToolbar: {enabled: false},
});
