import {build} from 'astro';
import {fileURLToPath} from 'node:url';

export function buildOffers() {
  return build({root:fileURLToPath(new URL('./', import.meta.url))});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildOffers();
