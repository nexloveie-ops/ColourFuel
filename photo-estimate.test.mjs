import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { estimatePhoto, sanitizeEstimate, readPhotoRequest, photoFoodList, createPhotoLimiter, PHOTO_MODEL, ESTIMATE_SCHEMA } from './photo-estimate.mjs';
import { handleRequest } from './server.mjs';

const catalog = { ingredients: [
  { variant_id: 'broccoli--raw', name_en: 'Broccoli', state: 'raw' },
  { variant_id: 'brown-rice--cooked', name_en: 'Brown rice', state: 'cooked' },
] };
const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');

test('food list is deterministic and names preparation state', () => {
  assert.equal(photoFoodList(catalog), 'broccoli--raw | Broccoli (raw)\nbrown-rice--cooked | Brown rice (cooked)');
});

test('request validation accepts photos only, within the size limit', () => {
  assert.deepEqual(readPhotoRequest({ media_type: 'image/jpeg', image_base64: tinyJpeg }), { image: tinyJpeg, mediaType: 'image/jpeg' });
  assert.ok(readPhotoRequest({ media_type: 'application/pdf', image_base64: tinyJpeg }).error);
  assert.ok(readPhotoRequest({ media_type: 'image/jpeg', image_base64: 'not base64!' }).error);
  assert.ok(readPhotoRequest({ media_type: 'image/jpeg', image_base64: 'A'.repeat(5_100_000) }).error);
});

test('estimates keep only library-backed ids and never carry nutrient values', () => {
  const result = sanitizeEstimate({
    is_food_photo: true, sauce_or_dressing_visible: true, note: 'Rice partly hidden.',
    foods: [
      { label: 'Broccoli', variant_id: 'broccoli--raw', grams: 60.4, confidence: 'high', kcal: 999 },
      { label: 'More broccoli', variant_id: 'broccoli--raw', grams: 20, confidence: 'medium' },
      { label: 'Falafel', variant_id: 'falafel--fried', grams: 80, confidence: 'medium' },
      { label: 'Rice', variant_id: 'brown-rice--cooked', grams: 5000, confidence: 'certain' },
      { label: 'Ghost', variant_id: 'none', grams: -3, confidence: 'low' },
    ],
  }, catalog);
  assert.equal(result.estimate_only, true);
  assert.equal(result.sauce_or_dressing_visible, true);
  assert.deepEqual(result.foods, [
    { label: 'Broccoli', variant_id: 'broccoli--raw', grams: 80, confidence: 'high', source: 'library' },
    { label: 'Falafel', variant_id: null, grams: 80, confidence: 'medium', source: 'not_found' },
    { label: 'Rice', variant_id: 'brown-rice--cooked', grams: 1000, confidence: 'low', source: 'library' },
  ]);
  assert.ok(!JSON.stringify(result).includes('999'));
  assert.deepEqual(sanitizeEstimate({ is_food_photo: false, foods: [{ variant_id: 'broccoli--raw', grams: 50 }] }, catalog).foods, []);
});

test('Claude request uses structured output, the image, the library and a refusal fallback', async () => {
  let sent;
  const client = { beta: { messages: { create: async params => { sent = params; return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ is_food_photo: true, foods: [{ label: 'Broccoli', variant_id: 'broccoli--raw', grams: 70, confidence: 'high' }], sauce_or_dressing_visible: false, note: '' }) }],
  }; } } } };
  const result = await estimatePhoto({ image: tinyJpeg, mediaType: 'image/jpeg', catalog, client });
  assert.equal(sent.model, PHOTO_MODEL);
  assert.equal(sent.fallbacks, 'default');
  assert.deepEqual(sent.output_config.format, { type: 'json_schema', schema: ESTIMATE_SCHEMA });
  const content = sent.messages[0].content;
  assert.ok(content[0].text.includes('broccoli--raw | Broccoli (raw)'));
  assert.deepEqual(content[1].source, { type: 'base64', media_type: 'image/jpeg', data: tinyJpeg });
  assert.equal(sent.thinking, undefined, 'Opus 5.5 rejects disabled thinking; leave it adaptive');
  // Weight calibration found by the photo eval (bias ×1.22 → ×1.09); keep the total check.
  assert.match(sent.system, /add up your weights/);
  assert.match(sent.system, /Never estimate or invent nutrient values/);
  assert.equal(result.foods[0].grams, 70);
});

test('refusals and unreadable output become customer-safe errors', async () => {
  const reply = r => ({ beta: { messages: { create: async () => r } } });
  await assert.rejects(estimatePhoto({ image: tinyJpeg, mediaType: 'image/jpeg', catalog, client: reply({ stop_reason: 'refusal', content: [] }) }), { status: 422 });
  await assert.rejects(estimatePhoto({ image: tinyJpeg, mediaType: 'image/jpeg', catalog, client: reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{oops' }] }) }), { status: 502 });
});

test('limiter caps each client per hour and the service per day', () => {
  let t = 0; const allow = createPhotoLimiter({ perClientHour: 2, perDay: 3, now: () => t });
  assert.equal(allow('a'), true); assert.equal(allow('a'), true); assert.equal(allow('a'), false);
  assert.equal(allow('b'), true); assert.equal(allow('c'), false, 'daily cap');
  t = 86_400_001; assert.equal(allow('a'), true);
});

async function post(body, { headers = { 'content-type': 'application/json' }, method = 'POST', deps = {} } = {}) {
  const req = Object.assign(new EventEmitter(), { url: '/api/photo-estimate', method, headers });
  const response = {};
  const done = handleRequest(req, { writeHead(s, h) { response.status = s; response.headers = h; }, end(b) { response.body = b; } }, {
    readCatalog: async () => catalog, photoEnabled: () => true, photoLimiter: () => true,
    estimatePhoto: async ({ catalog: c, mediaType }) => ({ estimate_only: true, foods: [], seen: [mediaType, c.ingredients.length] }), ...deps,
  });
  queueMicrotask(() => { if (body !== undefined) req.emit('data', Buffer.from(body)); req.emit('end'); });
  await done;
  return { ...response, json: response.body ? JSON.parse(response.body) : undefined };
}

test('photo endpoint: availability, validation, limits and no caching', async () => {
  const status = await post(undefined, { method: 'GET' });
  assert.deepEqual(status.json, { available: true, stores_photos: false });
  const ok = await post(JSON.stringify({ media_type: 'image/jpeg', image_base64: tinyJpeg }));
  assert.equal(ok.status, 200); assert.deepEqual(ok.json.seen, ['image/jpeg', 2]); assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal((await post('{}', { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await post('{bad')).status, 400);
  assert.equal((await post(JSON.stringify({ media_type: 'image/gif', image_base64: tinyJpeg }))).status, 400);
  assert.equal((await post(JSON.stringify({ media_type: 'image/jpeg', image_base64: tinyJpeg }), { deps: { photoLimiter: () => false } })).status, 429);
  assert.equal((await post(JSON.stringify({ media_type: 'image/jpeg', image_base64: tinyJpeg }), { deps: { photoEnabled: () => false } })).status, 503);
  assert.equal((await post('', { method: 'PUT' })).status, 405);
  const failed = await post(JSON.stringify({ media_type: 'image/jpeg', image_base64: tinyJpeg }), { deps: { estimatePhoto: async () => { throw Error('secret key sk-ant-xyz'); } } });
  assert.equal(failed.status, 503); assert.ok(!failed.body.includes('sk-ant'));
});

test('food entries are flat (a nested null-or-object field made the model list only one food)', () => {
  const item = ESTIMATE_SCHEMA.properties.foods.items;
  for (const [key, def] of Object.entries(item.properties)) assert.ok(!def.anyOf, `${key} must not be a nested null-or-object field`);
  const est = sanitizeEstimate({ is_food_photo: true, sauce_or_dressing_visible: false, note: '', foods: [
    { label: 'Broccoli', variant_id: 'broccoli--raw', grams: 50, confidence: 'high', library_name: 'Broccoli', category: 'vegetable', state: 'raw', usda_query: '', pack_label: { energy_kcal: null, fat_g: null, saturates_g: null, carbohydrate_g: null, sugars_g: null, fibre_g: null, protein_g: null, salt_g: null } },
    { label: 'Irish ham pieces', variant_id: 'none', grams: 110, confidence: 'medium', library_name: 'Cooked ham', category: 'meat', state: 'cured', usda_query: 'ham sliced deli', pack_label: { energy_kcal: 107, fat_g: 3, saturates_g: 1, carbohydrate_g: 1, sugars_g: 1, fibre_g: null, protein_g: 19, salt_g: 2 } },
  ] }, catalog);
  assert.equal(est.foods.length, 2);
  assert.equal(est.foods[0].lookup, undefined, 'library foods need no lookup');
  assert.deepEqual({ ...est.foods[1].lookup, pack_label: !!est.foods[1].lookup.pack_label }, { library_name: 'Cooked ham', category: 'meat', state: 'cured', usda_query: 'ham sliced deli', pack_label: true });
});
