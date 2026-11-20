// Migration 007 on embedded PostgreSQL: runtime can add a sourced food through the
// validated function only, the live catalogue view stays valid, and nothing existing changes.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { PGlite } from '@electric-sql/pglite';
import { prepareWebCatalog } from './web-catalog.mjs'; import { hydrateIngredientPhotos } from './ingredient-photos.mjs';
const local = s => s.replaceAll("current_database()<>'colourfuel'", "current_database()<>'postgres'");
const sql006 = local(await readFile(new URL('./migrations/006_persistent_catalog.sql', import.meta.url), 'utf8'));
const sql007 = local(await readFile(new URL('./migrations/007_photo_food_additions.sql', import.meta.url), 'utf8'));
const rollback007 = local(await readFile(new URL('./migrations/007_photo_food_additions.rollback.sql', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('./fixtures/persistent-catalog-source.json', import.meta.url)));
const legacy = { ...JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json', import.meta.url))), ingredients: source.ingredients.slice(0, 32) };
const quote = s => "'" + JSON.stringify(s).replaceAll("'", "''") + "'";
const ROLE = '"colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam"';
async function setup() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA colourfuel;CREATE TABLE colourfuel.schema_migration(migration_id text PRIMARY KEY,details jsonb);CREATE SCHEMA colourfuel_web;CREATE VIEW colourfuel_web.catalog AS SELECT ${quote(legacy)}::jsonb AS payload;CREATE ROLE ${ROLE};GRANT USAGE ON SCHEMA colourfuel_web TO ${ROLE};GRANT SELECT ON colourfuel_web.catalog TO ${ROLE};`);
  await pg.exec(sql006); await pg.exec(sql007); return pg;
}
const ham = { variant_id: 'ham-slices--cured', name_en: 'Ham slices', category: 'meat', state: 'cured', source_type: 'usda_fdc', record_id: 'usda_fdc:2705560', source_name: 'Ham, sliced, pre-packaged, deli meat', source_url: 'https://fdc.nal.usda.gov/food-details/2705560/nutrients', seen_label: 'Sliced cooked ham pieces',
  nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 106 }, { metric_id: 'protein', unit: 'g', value: 16.7 }, { metric_id: 'fat', unit: 'g', value: 3.7 }, { metric_id: 'sodium', unit: 'mg', value: 1040 }] };
const add = (pg, p) => pg.query('SELECT colourfuel_catalog.add_photo_food($1::jsonb) AS id', [JSON.stringify(p)]).then(r => r.rows[0].id);
const catalog = async pg => (await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;

test('runtime adds a sourced food through the function; catalogue, photos and rankings stay valid', async () => {
  const pg = await setup(); try {
    const before = await catalog(pg);
    await pg.exec(`SET ROLE ${ROLE}`);
    assert.equal(await add(pg, ham), 'ham-slices--cured');
    assert.equal(await add(pg, { ...ham, nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 1 }, { metric_id: 'protein', unit: 'g', value: 1 }] }), 'ham-slices--cured', 'existing food is never changed');
    await assert.rejects(pg.exec("INSERT INTO colourfuel_catalog.ingredient VALUES ('x','x','meat')"), /permission denied/);
    await assert.rejects(pg.exec("UPDATE colourfuel_catalog.observation SET primary_value=1"), /permission denied/);
    await assert.rejects(pg.exec("DELETE FROM colourfuel_catalog.variant"), /permission denied/);
    const after = await catalog(pg); await pg.exec('RESET ROLE');
    assert.equal(after.ingredients.length, before.ingredients.length + 1);
    const food = after.ingredients.find(f => f.variant_id === 'ham-slices--cured');
    assert.equal(food.verification_status, 'photo_added_unreviewed'); assert.equal(food.photo_addition.source_type, 'usda_fdc'); assert.equal(food.dataset_id, 'usda_fdc_photo_lookup');
    assert.equal(food.nutrients.find(n => n.metric_id === 'protein').primary_value, 16.7);
    assert.equal(food.nutrients.find(n => n.metric_id === 'iodine').result, 'missing', 'unknown stays unknown, never zero');
    assert.deepEqual(food.aliases, ['Sliced cooked ham pieces']);
    for (const f of before.ingredients) assert.deepEqual(after.ingredients.find(x => x.variant_id === f.variant_id), f, 'existing foods unchanged');
    const prepared = await prepareWebCatalog(after, (t, a) => pg.query(t, a));
    hydrateIngredientPhotos(prepared);
    const protein = prepared.nutrient_rankings.source_only.find(r => r.metric_id === 'protein');
    assert.equal(protein.coverage.total, after.ingredients.length); assert.ok(protein.rows.some(r => r.variant_id === 'ham-slices--cured'));
  } finally { await pg.close(); }
});

test('function rejects invented or implausible nutrition and unsourced records', async () => {
  const pg = await setup(); try {
    await pg.exec(`SET ROLE ${ROLE}`);
    const bad = [
      [{ source_type: 'claude_estimate' }, /USDA FoodData Central or a pack label/],
      [{ record_id: 'made-up' }, /Invalid USDA record/],
      [{ nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 106 }] }, /Energy and protein are required/],
      [{ nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 106 }, { metric_id: 'protein', unit: 'g', value: 160 }] }, /Implausible/],
      [{ nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 106 }, { metric_id: 'protein', unit: 'mg', value: 16 }] }, /Unknown metric or unit/],
      [{ category: 'dessert' }, /Invalid category/],
      [{ variant_id: 'ham--cured; DROP TABLE x' }, /Invalid variant id/],
      [{ variant_id: 'ham-slices--raw' }, /must end with the state/],
    ];
    for (const [change, error] of bad) { await assert.rejects(add(pg, { ...ham, ...change }), error); }
    await pg.exec('RESET ROLE');
    assert.equal((await pg.query("SELECT count(*)::int n FROM colourfuel_catalog.photo_addition")).rows[0].n, 0);
  } finally { await pg.close(); }
});

test('daily limit, re-run guard and rollback', async () => {
  const pg = await setup(); try {
    await pg.exec(`SET ROLE ${ROLE}`);
    for (let i = 0; i < 50; i++) await add(pg, { ...ham, variant_id: `food-${i}--cured`, name_en: `Food ${i}` });
    await assert.rejects(add(pg, { ...ham, variant_id: 'one-more--cured' }), /Daily photo addition limit/);
    await pg.exec('RESET ROLE');
    await assert.rejects(pg.exec(sql007), /already applied/); await pg.exec('ROLLBACK');
    await pg.exec(rollback007);
    await pg.exec(`SET ROLE ${ROLE}`);
    await assert.rejects(add(pg, { ...ham, variant_id: 'after-rollback--cured' }), /permission denied|does not exist/);
    await pg.exec('RESET ROLE');
    assert.equal((await catalog(pg)).ingredients.filter(f => f.photo_addition).length, 50, 'rollback keeps added foods');
  } finally { await pg.close(); }
});
