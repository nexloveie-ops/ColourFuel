import test from 'node:test'; import assert from 'node:assert/strict'; import { EventEmitter } from 'node:events';
import { fdcNutrients, labelNutrients, sourceFood, addMissingFoods, slug, searchUsda } from './food-additions.mjs';
import { sanitizeEstimate } from './photo-estimate.mjs';
import { handleRequest } from './server.mjs';

const metrics = [{ metric_id: 'energy_reported', unit: 'kcal' }, { metric_id: 'protein', unit: 'g' }, { metric_id: 'fat', unit: 'g' }, { metric_id: 'sodium', unit: 'mg' }, { metric_id: 'vitamin_b12', unit: 'µg' }, { metric_id: 'iodine', unit: 'µg' }];
const catalog = { metrics, ingredients: [{ variant_id: 'broccoli--raw', name_en: 'Broccoli', state: 'raw' }] };
const usdaHam = { fdcId: 2705560, description: 'Ham, sliced, pre-packaged, deli meat', dataType: 'Survey (FNDDS)', foodNutrients: [
  { nutrientNumber: '208', unitName: 'KCAL', value: 106 }, { nutrientNumber: '203', unitName: 'G', value: 16.7 }, { nutrientNumber: '204', unitName: 'G', value: 3.7 },
  { nutrientNumber: '307', unitName: 'MG', value: 1040 }, { nutrientNumber: '418', unitName: 'UG', value: 0.4 }, { nutrientNumber: '301', unitName: 'MG', value: 9 }] };
const raw = (newFood) => ({ is_food_photo: true, sauce_or_dressing_visible: false, note: '', foods: [
  { label: 'Broccoli', variant_id: 'broccoli--raw', grams: 50, confidence: 'high', new_food: null },
  { label: 'Sliced cooked ham pieces', variant_id: 'none', grams: 90, confidence: 'medium', new_food: newFood }] });
const hamLookup = (pack_label = null) => ({ library_name: 'Cooked ham', category: 'meat', state: 'cured', usda_query: 'ham sliced deli', pack_label });

test('USDA records map to library metrics by nutrient number and unit only', () => {
  assert.deepEqual(fdcNutrients(usdaHam, metrics).map(n => [n.metric_id, n.value]), [['energy_reported', 106], ['protein', 16.7], ['fat', 3.7], ['sodium', 1040], ['vitamin_b12', 0.4]]);
  assert.ok(!fdcNutrients({ foodNutrients: [{ nutrientNumber: '203', unitName: 'MG', value: 5 }] }, metrics).length, 'unit mismatch is dropped, not converted by guess');
});

test('pack label values convert salt to sodium and carbohydrate to by-difference; missing stays missing', () => {
  const n = Object.fromEntries(labelNutrients({ energy_kcal: 110, fat_g: 3, saturates_g: 1.1, carbohydrate_g: 1.2, sugars_g: 0.8, fibre_g: 0.5, protein_g: 20, salt_g: 2 }).map(x => [x.metric_id, x]));
  assert.equal(n.sodium.value, 800); assert.equal(n.sodium.qualifier, 'label_salt_converted');
  assert.equal(n.carbohydrate_by_difference.value, 1.7);
  assert.deepEqual(labelNutrients({ energy_kcal: 110, protein_g: null }), [], 'energy and protein needed');
  assert.equal(Object.keys(Object.fromEntries(labelNutrients({ energy_kcal: 110, protein_g: 20 }).map(x => [x.metric_id, 1]))).length, 2);
});

test('sourceFood prefers the printed label, else a USDA record Claude confirmed; never invents', async () => {
  const est = sanitizeEstimate(raw(hamLookup({ energy_kcal: 107, fat_g: 3.2, saturates_g: 1.1, carbohydrate_g: 1, sugars_g: 1, fibre_g: null, protein_g: 19, salt_g: 2.1 })), catalog);
  const ham = est.foods[1];
  let searched = false;
  const deps = { searchUsda: async () => { searched = true; return [usdaHam]; }, chooseUsdaRecord: async (lk, c) => c[0] };
  const fromLabel = await sourceFood(ham, metrics, deps);
  assert.equal(fromLabel.source_type, 'pack_label'); assert.match(fromLabel.record_id, /^pack_label:[0-9a-f]{12}$/); assert.equal(searched, false);
  assert.equal(fromLabel.variant_id, 'cooked-ham--cured');
  const viaUsda = await sourceFood(sanitizeEstimate(raw(hamLookup()), catalog).foods[1], metrics, deps);
  assert.equal(viaUsda.source_type, 'usda_fdc'); assert.equal(viaUsda.record_id, 'usda_fdc:2705560'); assert.match(viaUsda.source_url, /fdc\.nal\.usda\.gov\/food-details\/2705560/);
  assert.equal(await sourceFood(sanitizeEstimate(raw(hamLookup()), catalog).foods[1], metrics, { searchUsda: async () => [usdaHam], chooseUsdaRecord: async () => null }), null, 'no confirmed match → nothing added');
});

test('addMissingFoods adds through the database function, reuses existing library foods, and tolerates failures', async () => {
  const calls = [];
  const deps = { searchUsda: async () => [usdaHam], chooseUsdaRecord: async (lk, c) => c[0], addPhotoFood: async p => { calls.push(p); return p.variant_id; } };
  const est = sanitizeEstimate(raw(hamLookup()), catalog);
  assert.deepEqual(await addMissingFoods(est, catalog, deps), ['cooked-ham--cured']);
  assert.equal(est.foods[1].variant_id, 'cooked-ham--cured'); assert.equal(est.foods[1].source, 'added_usda');
  assert.ok(!('lookup' in JSON.parse(JSON.stringify(est)).foods[1]), 'internal lookup never leaves the server');
  const withHam = { metrics, ingredients: [...catalog.ingredients, { variant_id: 'cooked-ham--cured', name_en: 'Cooked ham', photo_addition: { source_type: 'usda_fdc' } }] };
  const again = sanitizeEstimate(raw(hamLookup()), withHam);
  assert.deepEqual(await addMissingFoods(again, withHam, { ...deps, searchUsda: async () => { throw Error('should not search'); } }), []);
  assert.equal(again.foods[1].source, 'library_photo_added');
  const failing = sanitizeEstimate(raw(hamLookup()), catalog);
  assert.deepEqual(await addMissingFoods(failing, catalog, { ...deps, addPhotoFood: async () => { throw Object.assign(Error('denied'), { code: '42501' }); } }), []);
  assert.equal(failing.foods[1].source, 'not_found'); assert.equal(failing.foods[1].variant_id, null);
  assert.equal(slug('Cooked ham — Irish!'), 'cooked-ham-irish');
});

test('USDA key travels in a header, not the URL', async () => {
  let seen;
  await searchUsda('ham', { apiKey: 'k-123', fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ foods: [usdaHam] }) }; } });
  assert.ok(!seen.url.includes('k-123')); assert.equal(seen.init.headers['X-Api-Key'], 'k-123');
  assert.deepEqual(await searchUsda('ham', { apiKey: '' }), []);
});

test('server returns the new library record so the app can calculate it at once', async () => {
  let reads = 0;
  const base = { data_mode: 'live', metrics, ingredients: catalog.ingredients };
  const req = Object.assign(new EventEmitter(), { url: '/api/photo-estimate', method: 'POST', headers: { 'content-type': 'application/json' } });
  const out = {};
  const done = handleRequest(req, { writeHead(s) { out.status = s; }, end(b) { out.body = b; } }, {
    photoEnabled: () => true, photoLimiter: () => true,
    readCatalog: async () => (++reads === 1 ? base : { ...base, ingredients: [...base.ingredients, { variant_id: 'cooked-ham--cured', name_en: 'Cooked ham', photo_addition: { source_type: 'usda_fdc' } }] }),
    estimatePhoto: async ({ catalog: c }) => sanitizeEstimate(raw(hamLookup()), c),
    foodLookups: { searchUsda: async () => [usdaHam], chooseUsdaRecord: async (lk, c) => c[0], addPhotoFood: async p => p.variant_id },
    attachFoodPhotos: async () => [],
  });
  queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify({ media_type: 'image/jpeg', image_base64: '/9j/2Q==' }))); req.emit('end'); });
  await done;
  const body = JSON.parse(out.body);
  assert.equal(out.status, 200);
  assert.deepEqual(body.foods.map(f => [f.variant_id, f.source]), [['broccoli--raw', 'library'], ['cooked-ham--cured', 'added_usda']]);
  assert.deepEqual(body.food_records.map(f => f.variant_id), ['broccoli--raw', 'cooked-ham--cured'], 'records for every matched food');
});
