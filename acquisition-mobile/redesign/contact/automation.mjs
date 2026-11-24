import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, realpath, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {functionPayload} from '../../scripts/deploys.mjs';

// Prepare exactly one function with the same bundler as the installed Netlify CLI.
export async function prepareAutomation(baseDeploy) {
  const previous = baseDeploy.available_functions.find(fn => fn.n === 'automation');
  assert.match(previous?.r || '', /^nodejs\d+\.x$/);
  assert.equal(previous.bd?.runtimeAPIVersion, 2);
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const executable = execFileSync('which', ['netlify'], {encoding:'utf8'}).trim();
  const cliRequire = createRequire(await realpath(executable));
  const {zipFunction} = await import(pathToFileURL(cliRequire.resolve('@netlify/zip-it-and-ship-it')));
  const temporary = await mkdtemp(join(tmpdir(), 'flexweb-contact-automation-'));
  try {
    const built = await zipFunction(join(root, 'netlify/functions/automation.ts'), temporary, {
      archiveFormat:'zip', basePath:root, repositoryRoot:root,
      config:{automation:{nodeBundler:'esbuild', nodeVersion:previous.r.replace('nodejs','')}},
    });
    assert.equal(built.name, previous.n);
    assert.equal(built.runtimeVersion, previous.r);
    assert.equal(built.invocationMode, previous.im);
    assert.equal(built.priority, previous.p);
    assert.equal(built.runtimeAPIVersion, previous.bd.runtimeAPIVersion);
    assert.deepEqual(built.routes.map(r => [r.pattern, r.expression, r.methods || [], !!r.preferStatic]),
      previous.ro.map(r => [r.p, r.e, r.m || [], !!r.ps]));
    const bytes = await readFile(built.path);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const expectedDeploy = {...baseDeploy, available_functions:baseDeploy.available_functions.map(fn =>
      fn.n === 'automation' ? {...fn, d:digest, bd:built.buildData} : fn)};
    const query = new URLSearchParams({runtime:built.runtimeVersion, invocation_mode:built.invocationMode});
    if (built.timeout != null) query.set('timeout', String(built.timeout));
    return {bytes, digest, payload:functionPayload(expectedDeploy), expectedDeploy, uploadPath:'/functions/automation?' + query};
  } finally {
    await rm(temporary,{recursive:true,force:true});
  }
}
