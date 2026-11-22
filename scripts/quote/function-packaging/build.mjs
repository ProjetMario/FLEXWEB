import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Netlify requests uploads for these function archives in this release.
// Package the three unchanged sources; do not change any function behavior.
// The source hashes below are identical to their last modifications before
// the original October deployments, and are checked again after packaging.
const packagingRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packagingRoot, '../../..');
const outputDirectory = path.join(repositoryRoot, '.cms/application-budget-functions');
const manifestFile = path.join(repositoryRoot, '.cms/application-budget-functions.json');
const expectedSources = {
  'netlify/functions/automation-clock.ts': '4f7f639af5d13e16c17a61a261928c5524a5f0a3',
  'netlify/functions/automation.ts': '0bcdf362121f0ff4485a2ea8c30bfe85baf15898',
  'netlify/functions/retired-content.mts': '35e8117ed50ca65a7c622c2538e189d9b6f6dfb6',
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const expectedVersions = {
  '@netlify/zip-it-and-ship-it': '14.3.1',
  '@netlify/serverless-functions-api': '2.24.0',
};

async function verifySources() {
  const result = {};
  const folderEntries = await fs.readdir(path.join(repositoryRoot, 'netlify/functions'));
  assert(folderEntries.length === 3 && folderEntries.every(name => Object.hasOwn(expectedSources, `netlify/functions/${name}`)), 'Unexpected function source inventory');
  for (const [name, expected] of Object.entries(expectedSources)) {
    const filename = path.join(repositoryRoot, name);
    const stat = await fs.lstat(filename);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Invalid function source: ${name}`);
    const bytes = await fs.readFile(filename);
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert(hash === expected, `Function source changed: ${name}`);
    result[name] = hash;
  }
  return result;
}

assert(process.version === 'v24.22.2', 'Use pinned Node.js 24.22.2 for function packaging');
const sourceBlobHashes = await verifySources();
for (const [dependency, expected] of Object.entries(expectedVersions)) {
  const installed = JSON.parse(await fs.readFile(path.join(packagingRoot, 'node_modules', dependency, 'package.json'), 'utf8'));
  assert(installed.version === expected, `Unexpected packaging dependency: ${dependency}`);
}
await fs.mkdir(outputDirectory, { recursive: true });
const temporaryDirectory = path.join(outputDirectory, 'tmp');
await fs.mkdir(temporaryDirectory, { recursive: true });
// Keep bundler scratch files within this build's ignored output directory.
process.env.TMPDIR = temporaryDirectory;
const { zipFunctions } = await import('@netlify/zip-it-and-ship-it');
const packaged = await zipFunctions(path.join(repositoryRoot, 'netlify/functions'), outputDirectory, {
  basePath: repositoryRoot,
  repositoryRoot,
  config: { '*': { nodeBundler: 'esbuild', nodeVersion: '22' } },
});
assert(packaged.length === 3, 'Unexpected packaged function count');
const allowedInputs = new Set([...Object.keys(expectedSources).map(name => path.join(repositoryRoot, name)), path.join(repositoryRoot, 'package.json')]);
const functions = [];
for (const entry of packaged) {
  assert(['automation-clock', 'automation', 'retired-content'].includes(entry.name), 'Unexpected packaged function');
  assert(entry.runtimeVersion === 'nodejs22.x' && entry.invocationMode === 'stream', `Function runtime changed: ${entry.name}`);
  assert(entry.bootstrapVersion === '2.24.0' && entry.runtimeAPIVersion === 2 && entry.priority === 10, `Function packaging metadata changed: ${entry.name}`);
  assert(entry.inputs.every(filename => allowedInputs.has(path.resolve(filename))), `Unexpected function dependency: ${entry.name}`);
  const expectedFile = path.join(outputDirectory, `${entry.name}.zip`);
  assert(path.resolve(entry.path) === expectedFile, 'Unexpected archive output path');
  const bytes = await fs.readFile(expectedFile);
  functions.push({
    name: entry.name,
    path: path.relative(repositoryRoot, expectedFile).split(path.sep).join('/'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    runtime: 'nodejs22.x',
    invocationMode: 'stream',
    routes: entry.routes || [],
    schedule: entry.schedule || null,
    priority: entry.priority,
    bootstrapVersion: entry.bootstrapVersion,
    runtimeAPIVersion: entry.runtimeAPIVersion,
  });
}
functions.sort((a, b) => a.name.localeCompare(b.name));
assert(new Set(functions.map(entry => entry.name)).size === 3, 'Duplicate packaged function');
assert(functions.find(entry => entry.name === 'automation-clock').schedule === '*/10 * * * *', 'Automation schedule changed');
assert(functions.filter(entry => entry.schedule).length === 1, 'Unexpected function schedule');
assert(JSON.stringify(await verifySources()) === JSON.stringify(sourceBlobHashes), 'Function source changed while packaging');
const manifest = {
  schemaVersion: 1,
  sourceBlobHashes,
  packaging: { zisi: '14.3.1', bootstrap: '2.24.0', node: process.version },
  functions,
};
await fs.writeFile(`${manifestFile}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.rename(`${manifestFile}.tmp`, manifestFile);
console.log(JSON.stringify({ sourceFilesUnchanged: true, functions: functions.map(({ name, sha256 }) => ({ name, sha256 })), manifest: path.relative(repositoryRoot, manifestFile) }));
