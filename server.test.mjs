import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from './server.mjs';

async function request(url, { method = 'GET', readCatalog = async () => ({ data_mode: 'live', ingredients: [], recipes: [] }) } = {}) {
  const response = {};
  await handleRequest({ url, method }, {
    writeHead(status, headers) { response.status = status; response.headers = headers; },
    end(body) { response.body = body; },
  }, { readCatalog });
  return response;
}

test('catalogue queries the provider on every request, without a snapshot fallback', async () => {
  let count = 0;
  const readCatalog = async () => ({ data_mode: 'live', revision: ++count });
  assert.equal(JSON.parse((await request('/api/catalog', { readCatalog })).body).revision, 1);
  const next = await request('/api/catalog', { readCatalog });
  assert.equal(JSON.parse(next.body).revision, 2);
  assert.equal(next.headers['Cache-Control'], 'no-store');
});
test('database failures return 503 without leaking configuration or stale nutrition', async () => {
  const result = await request('/api/catalog', { readCatalog: async () => { throw Error('private connection details'); } });
  assert.equal(result.status, 503);
  assert.ok(!result.body.includes('private'));
  assert.ok(!result.body.includes('ingredients'));
});
test('nutrition nulls, trace and provenance survive the API unchanged', async () => {
  const value = { ingredients: [{ value: null, kind: 'trace', record_id: 'source:123' }] };
  const result = await request('/api/catalog', { readCatalog: async () => value });
  assert.deepEqual(JSON.parse(result.body), value);
});
test('only public assets and read endpoints are served', async () => {
  for (const path of ['/db.mjs', '/server.mjs', '/004_live_catalog.sql', '/cloudbuild.yaml', '/data.js', '/data.json', '/.git/config', '/../.env']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/api/catalog', { method: 'POST' })).status, 405);
  assert.equal((await request('/api/catalog', { method: 'HEAD' })).body, undefined);
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/')).status, 200);
});
