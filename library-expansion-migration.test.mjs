// Migration 009 on embedded PostgreSQL: 400 sourced foods are added, nothing existing changes,
// the catalogue view, rankings and photo invariant stay valid, and the rollback removes only the batch.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { createHash } from 'node:crypto'; import { PGlite } from '@electric-sql/pglite';
import { prepareWebCatalog } from './web-catalog.mjs'; import { browseIngredients, isBowlAddOn } from './ingredient-library.mjs';
const local = s => s.replaceAll("current_database()<>'colourfuel'", "current_database()<>'postgres'");
const mig = n => readFile(new URL(`./migrations/${n}.sql`, import.meta.url), 'utf8').then(local);
const source = JSON.parse(await readFile(new URL('./fixtures/persistent-catalog-source.json', import.meta.url)));
const captureText = await readFile(new URL('./fixtures/library-expansion-009.json', import.meta.url), 'utf8');
const capture = JSON.parse(captureText);
const legacy = { ...JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json', import.meta.url))), ingredients: source.ingredients.slice(0, 32) };
const quote = s => "'" + JSON.stringify(s).replaceAll("'", "''") + "'";
const ROLE = '"colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam"';
async function setup(upTo = ['006_persistent_catalog', '007_photo_food_additions', '008_photo_food_images']) {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA colourfuel;CREATE TABLE colourfuel.schema_migration(migration_id text PRIMARY KEY,details jsonb);CREATE SCHEMA colourfuel_web;CREATE VIEW colourfuel_web.catalog AS SELECT ${quote(legacy)}::jsonb AS payload;CREATE ROLE ${ROLE};GRANT USAGE ON SCHEMA colourfuel_web TO ${ROLE};GRANT SELECT ON colourfuel_web.catalog TO ${ROLE};`);
  for (const n of upTo) await pg.exec(await mig(n));
  return pg;
}
const catalog = async pg => (await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;
const strip = c => { const { read_at, ...rest } = c; return rest; };

test('capture matches its checksum, the reviewed food list and the registered datasets', async () => {
  assert.equal(createHash('sha256').update(captureText).digest('hex'), (await readFile(new URL('./fixtures/library-expansion-009.sha256', import.meta.url), 'utf8')).trim());
  const list = (await readFile(new URL('./migrations/009-food-list.txt', import.meta.url), 'utf8')).split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('|'));
  assert.equal(capture.foods.length, 400); assert.deepEqual(capture.foods.map(f => f.variant_id), list.map(l => l[0]));
  const registered = Object.fromEntries(source.datasets.map(d => [d.dataset_id, d.sha256]));
  for (const [id, hash] of Object.entries(capture.prepared_from)) assert.equal(registered[id], hash, `${id} is the registered file`);
  const existing = new Set(source.ingredients.map(f => f.variant_id));
  for (const f of capture.foods) {
    assert.ok(!existing.has(f.variant_id), `${f.variant_id} is new`);
    assert.equal(f.nutrients.length, 33); assert.deepEqual(f.aliases.length, 2);
    if (f.dataset_id === 'uk_cofid_2021') for (const m of ['carbohydrate_by_difference', 'fibre_total_dietary', 'sugars_total']) assert.equal(f.nutrients.find(n => n.metric_id === m).result, 'missing', 'USDA-definition metrics are not filled from CoFID');
  }
});

test('009 adds 400 sourced foods without changing existing foods; rankings and photos stay valid', async () => {
  const pg = await setup(); try {
    const before = await catalog(pg);
    await pg.exec(await mig('009_library_expansion'));
    const after = await catalog(pg);
    assert.equal(after.ingredients.length, before.ingredients.length + 400);
    assert.equal(after.ingredient_photos.length, after.ingredients.length);
    for (const f of before.ingredients) assert.deepEqual(after.ingredients.find(x => x.variant_id === f.variant_id), f, 'existing foods unchanged');
    const rashers = after.ingredients.find(f => f.variant_id === 'back-rashers--grilled');
    assert.equal(rashers.dataset_id, 'uk_cofid_2021'); assert.equal(rashers.verification_status, 'source_matched'); assert.equal(rashers.library_batch, 'ireland-core-2026-11-20');
    assert.equal(rashers.nutrients.find(n => n.metric_id === 'energy_reported').primary_value, 287);
    assert.equal(rashers.nutrients.find(n => n.metric_id === 'carbohydrate_by_difference').result, 'missing');
    assert.deepEqual(rashers.aliases, ['Back rashers', '培根(背部)']);
    const cod = after.ingredients.find(f => f.variant_id === 'cod--raw');
    assert.equal(cod.source_url, 'https://fdc.nal.usda.gov/food-details/171955/nutrients');
    assert.equal(cod.nutrients.find(n => n.metric_id === 'protein').primary_value, 17.8);
    const tea = after.ingredients.find(f => f.variant_id === 'tea--ready_to_use');
    assert.equal(tea.nutrients.find(n => n.metric_id === 'energy_reported').result, 'trace_retained', 'CoFID trace stays trace, never zero');
    assert.equal(after.ingredient_photos.find(p => p.variant_id === 'cod--raw').placeholder, true);
    const prepared = await prepareWebCatalog(after, (t, a) => pg.query(t, a));
    assert.equal(prepared.ingredients.length, after.ingredients.length);
    const browse = browseIngredients(prepared.ingredients, { query: '黑布丁' });
    assert.deepEqual(browse.groups.flatMap(g => g.items.map(f => f.variant_id)).sort(), ['black-pudding--fried', 'black-pudding--raw']);
    await pg.exec(`SET ROLE ${ROLE}`);
    assert.equal(await pg.query("SELECT colourfuel_catalog.add_photo_food('{\"variant_id\":\"rocket--raw\"}'::jsonb) id").then(r => r.rows[0].id), 'rocket--raw', 'photo additions reuse a library food');
    await assert.rejects(pg.exec("DELETE FROM colourfuel_catalog.variant WHERE variant_id='rocket--raw'"), /permission denied/);
    await pg.exec('RESET ROLE');
    await assert.rejects(pg.exec(await mig('009_library_expansion')), /already applied/); await pg.exec('ROLLBACK');
    await pg.exec(await mig('009_library_expansion.rollback'));
    assert.deepEqual(strip(await catalog(pg)), strip(before), 'rollback restores the catalogue exactly');
  } finally { await pg.close(); }
});

test('009 refuses a capture food that already exists, and leaves nothing behind', async () => {
  const pg = await setup(); try {
    const before = await catalog(pg);
    const bad = (await mig('009_library_expansion')).replace('"variant_id":"rocket--raw","ingredient_id":"rocket"', '"variant_id":"broccoli--raw","ingredient_id":"broccoli"');
    await assert.rejects(pg.exec(bad), /Invalid variant id|already in the library/); await pg.exec('ROLLBACK');
    assert.deepEqual(strip(await catalog(pg)), strip(before));
  } finally { await pg.close(); }
});

test('bowl add-ons leave out raw, dry and drink-like foods from the expansion', () => {
  const food = id => { const f = capture.foods.find(x => x.variant_id === id); return { ...f }; };
  for (const id of ['red-lentil--dry', 'chickpea--dry', 'pumpkin--raw', 'semi-skimmed-milk--pasteurised', 'apple-juice--ready_to_use', 'soya-milk--ready_to_use', 'double-cream--ready_to_use', 'back-rashers--raw', 'plain-flour--dry', 'rhubarb--raw', 'tea--ready_to_use'])
    assert.equal(isBowlAddOn(food(id)), false, id);
  for (const id of ['rocket--raw', 'back-rashers--grilled', 'smoked-salmon--smoked', 'black-bean--boiled', 'cheddar--ready_to_eat', 'white-rice--cooked'])
    assert.equal(isBowlAddOn(food(id)), true, id);
});

test('010 photo manifest: checksum, open licences, Commons sources, 009 foods only', async () => {
  const text = await readFile(new URL('./fixtures/library-photos-010.json', import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(text).digest('hex'), (await readFile(new URL('./fixtures/library-photos-010.sha256', import.meta.url), 'utf8')).trim());
  const { photos } = JSON.parse(text); const batch = new Set(capture.foods.map(f => f.variant_id));
  assert.ok(photos.length > 300); assert.equal(new Set(photos.map(p => p.variant_id)).size, photos.length);
  for (const p of photos) {
    assert.ok(batch.has(p.variant_id), p.variant_id);
    assert.match(p.license, /^(CC0( 1\.0)?|Public domain|CC BY( [0-9.]+)?|CC BY-SA( [0-9.]+)?)$/i, p.variant_id);
    assert.match(p.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/); assert.ok(p.artist.trim());
    assert.match(p.sha256, /^[0-9a-f]{64}$/); assert.ok(p.bytes >= 1000 && p.bytes <= 400000);
    assert.ok(p.width >= 100 && p.width <= 2000 && p.height >= 100 && p.height <= 2000);
  }
});
