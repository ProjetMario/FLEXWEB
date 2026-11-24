import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, realpath, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {cache} from '../../scripts/baseline.mjs';

export const cataloguePrefixes = ['/territoires/', '/en/locations/', '/projets-sites/'];
export const bundleDirectory = resolve(cache, 'contact', 'edge-bundle');
export async function buildEdge() {
  // Use the same official bundler as the installed Netlify CLI.
  const executable = execFileSync('which', ['netlify'], {encoding:'utf8'}).trim();
  const cliRequire = createRequire(await realpath(executable));
  const {bundle} = await import(pathToFileURL(cliRequire.resolve('@netlify/edge-bundler')));
  const source = fileURLToPath(new URL('./edge/', import.meta.url));
  const root = resolve(source, '../../../..');
  await rm(bundleDirectory, {recursive:true, force:true});
  await mkdir(bundleDirectory, {recursive:true});
  const declarations = cataloguePrefixes.map(prefix => ({function:'public-contact', path:prefix + '*'}));
  const {manifest} = await bundle([source], bundleDirectory, declarations, {basePath:root, rootPath:root});
  assert.ok(manifest?.bundles?.length && manifest.routes.length === declarations.length);
  return manifest;
}
