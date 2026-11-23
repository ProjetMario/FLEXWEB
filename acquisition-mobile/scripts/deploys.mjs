import assert from 'node:assert/strict';
import { api, sha } from './baseline.mjs';

export const digestOf = files => sha(Buffer.from(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')))));

export async function manifestOf(id, expectedCount) {
  const files = {};
  for (let page = 1; page <= Math.ceil(expectedCount / 100) + 1; page++) {
    const batch = await api('/deploys/' + id + '/files?per_page=100&page=' + page);
    for (const asset of batch) {
      assert.equal(asset.deploy_id, id);
      assert.ok(!Object.hasOwn(files, asset.path), 'Fichier répété : ' + asset.path);
      files[asset.path] = asset.sha;
    }
    if (batch.length < 100) break;
  }
  assert.equal(Object.keys(files).length, expectedCount, 'Inventaire incomplet');
  return files;
}

export function functionPayload(deploy) {
  return {
    functions: Object.fromEntries(deploy.available_functions.map(f => [f.n, f.d])),
    functions_config: Object.fromEntries(deploy.available_functions.map(f => [f.n, {
      priority: f.p, build_data: f.bd, region: f.rgo, memory: f.mo,
      routes: f.ro?.map(r => ({ pattern: r.p, literal: r.l, expression: r.e, methods: r.m || [], prefer_static: !!r.ps })),
    }])),
    function_schedules: deploy.function_schedules,
  };
}

export function assertFunctions(original, candidate) {
  assert.deepEqual(candidate.function_schedules, original.function_schedules);
  assert.equal(candidate.available_functions.length, original.available_functions.length);
  assert.equal(!!candidate.edge_functions_present, !!original.edge_functions_present);
  assert.deepEqual(candidate.server, original.server);
  for (const production of original.available_functions) {
    const result = candidate.available_functions.find(f => f.n === production.n);
    assert.ok(result);
    for (const field of ['d', 'r', 'rg', 'm', 'im', 'bd', 'p']) assert.deepEqual(result[field], production[field]);
    const routes = f => (f.ro || []).map(r => ({ ...r, m: r.m || [] }));
    assert.deepEqual(routes(result), routes(production));
  }
}

export async function waitReady(id) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const result = await api('/deploys/' + id);
    if (result.state === 'ready' && result.summary?.status === 'ready') return result;
    assert.ok(!['error', 'rejected'].includes(result.state), result.error_message);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Délai de traitement Netlify dépassé pour ' + id);
}
