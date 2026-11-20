// The live catalogue is reused for a few minutes per instance, served stale while one refresh
// runs, and invalidated by photo additions.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readCatalog, invalidateCatalog, CATALOG_TTL_MS } from './db.mjs';
test('catalogue cache: one query per TTL, stale-while-refresh, invalidation', async () => {
  invalidateCatalog(); let calls = 0; let release;
  const query = () => { calls++; return calls === 2 ? new Promise(r => { release = () => r({ v: 2 }); }) : Promise.resolve({ v: calls }); };
  const t0 = 1_000_000;
  assert.deepEqual(await readCatalog({ query, now: t0 }), { v: 1 });
  assert.deepEqual(await readCatalog({ query, now: t0 + 1000 }), { v: 1 }); assert.equal(calls, 1, 'fresh copy reused');
  assert.deepEqual(await readCatalog({ query, now: t0 + CATALOG_TTL_MS + 1 }), { v: 1 }, 'stale copy served at once');
  assert.deepEqual(await readCatalog({ query, now: t0 + CATALOG_TTL_MS + 2 }), { v: 1 }); assert.equal(calls, 2, 'only one refresh in flight');
  release(); await new Promise(r => setImmediate(r));
  assert.deepEqual(await readCatalog({ query, now: Date.now() }), { v: 2 });
  invalidateCatalog();
  assert.deepEqual(await readCatalog({ query, now: Date.now() }), { v: 3 }, 'invalidation forces a fresh read'); invalidateCatalog();
});
