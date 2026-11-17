import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import { handleRequest } from './server.mjs';

async function request(url, { method = 'GET', headers={}, readCatalog = async () => ({ data_mode: 'live', ingredients: [], recipes: [] }) } = {}) {
  const response = {};
  await handleRequest({ url, method, headers }, {
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
  for (const path of ['/db.mjs', '/server.mjs', '/004_live_catalog.sql', '/005_sample_products.sql', '/cloudbuild.yaml', '/data.js', '/data.json', '/.git/config', '/../.env']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/api/catalog', { method: 'POST' })).status, 405);
  assert.equal((await request('/api/catalog', { method: 'HEAD' })).body, undefined);
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/')).status, 200);
});

test('recipe studio modules are public JavaScript assets', async () => {
  for (const path of ['/recipe-engine.mjs', '/recipe-studio.mjs']) {
    const result = await request(path);
    assert.equal(result.status, 200);
    assert.match(result.headers['Content-Type'], /javascript/);
  }
  assert.equal((await request('/studio.css')).status, 200);
});

test('compressed catalogue preserves exact values and reduces transmission size', async()=>{
 const value={data_mode:'live',ingredients:Array.from({length:100},()=>({protein:null,record_id:'USDA:123',kind:'trace'}))};
 const result=await request('/api/catalog',{headers:{'accept-encoding':'gzip'},readCatalog:async()=>value});
 assert.equal(result.headers['Content-Encoding'],'gzip');assert.equal(result.headers['Cache-Control'],'no-store');
 assert.deepEqual(JSON.parse(gunzipSync(result.body)),value);assert.ok(result.body.length<JSON.stringify(value).length/2);
 const script=await request('/product-content.mjs',{headers:{'accept-encoding':'gzip'}});assert.match(gunzipSync(script.body).toString(),/Rainbow Chicken/);
});

test('all three serving images are served and disabled gzip is respected',async()=>{
 for(const image of ['rainbow-chicken','vegan-power','signature-salmon'])for(const size of ['','-small']){
  const result=await request('/'+image+size+'.jpg');assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'image/jpeg');assert.equal(result.body[0],255);assert.equal(result.body[1],216);
 }
 const result=await request('/api/catalog',{headers:{'accept-encoding':'gzip;q=0.0'}});assert.equal(result.headers['Content-Encoding'],undefined);
});

test('all reviewed runtime assets are served while previews and offline sources stay private',async()=>{
 const {PUBLIC_ASSETS}=await import('./public-assets.mjs');
 for(const name of PUBLIC_ASSETS){const result=await request('/'+name,{method:'HEAD'});assert.equal(result.status,200,name);assert.ok(Number(result.headers['Content-Length'])>0,name);assert.equal(result.body,undefined,name);}
 for(const name of ['/fixtures/catalog-test-snapshot.json','/previews/colourfuel-bowl/index.html','/public-assets.mjs','/ingredient-photos.test.mjs','/ingredient-research.json'])assert.equal((await request(name)).status,404,name);
});

test('database query modules and server catalogue preparation are never public assets',async()=>{
 for(const path of ['/nutrient-ranking-query.mjs','/web-catalog.mjs','/irish-ingredient-expansion.mjs','/research/ireland-expansion-2026-11-17.json'])assert.equal((await request(path)).status,404);
});
