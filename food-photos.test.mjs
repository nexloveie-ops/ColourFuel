// Migration 008 + Commons photo flow: only placeholders of photo-added foods can be replaced,
// only by openly licensed Commons JPEGs; images are served from the database.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { EventEmitter } from 'node:events'; import { PGlite } from '@electric-sql/pglite';
import { searchCommons, attachFoodPhotos, jpegSize, PLACEHOLDER } from './food-photos.mjs';
import { handleRequest } from './server.mjs';
const local = s => s.replaceAll("current_database()<>'colourfuel'", "current_database()<>'postgres'");
const mig = n => readFile(new URL(`./migrations/${n}.sql`, import.meta.url), 'utf8').then(local);
const source = JSON.parse(await readFile(new URL('./fixtures/persistent-catalog-source.json', import.meta.url)));
const legacy = { ...JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json', import.meta.url))), ingredients: source.ingredients.slice(0, 32) };
const quote = s => "'" + JSON.stringify(s).replaceAll("'", "''") + "'";
const ROLE = '"colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam"';
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5000, 7)]);
const info = { title: 'Sliced cooked ham.jpg', artist: 'Anna.Massini', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0', width: 720, height: 403, source_url: 'https://commons.wikimedia.org/wiki/File:Sliced_cooked_ham.jpg', original_url: 'https://upload.wikimedia.org/x.jpg', description: 'Sliced cooked ham' };
async function setup() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA colourfuel;CREATE TABLE colourfuel.schema_migration(migration_id text PRIMARY KEY,details jsonb);CREATE SCHEMA colourfuel_web;CREATE VIEW colourfuel_web.catalog AS SELECT ${quote(legacy)}::jsonb AS payload;CREATE ROLE ${ROLE};GRANT USAGE ON SCHEMA colourfuel_web TO ${ROLE};GRANT SELECT ON colourfuel_web.catalog TO ${ROLE};`);
  for (const n of ['006_persistent_catalog', '007_photo_food_additions', '008_photo_food_images']) await pg.exec(await mig(n));
  await pg.exec(`SET ROLE ${ROLE}`);
  await pg.query('SELECT colourfuel_catalog.add_photo_food($1::jsonb)', [JSON.stringify({ variant_id: 'cooked-ham--cured', name_en: 'Cooked ham', category: 'meat', state: 'cured', source_type: 'usda_fdc', record_id: 'usda_fdc:746952', seen_label: 'ham', nutrients: [{ metric_id: 'energy_reported', unit: 'kcal', value: 121 }, { metric_id: 'protein', unit: 'g', value: 19.6 }] })]);
  return pg;
}
const setImg = (pg, vid, i = info, b = jpeg) => pg.query('SELECT colourfuel_catalog.set_photo_food_image($1,$2::jsonb,$3) path', [vid, JSON.stringify(i), b]).then(r => r.rows[0].path);
const photoOf = async (pg, vid) => (await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload.ingredient_photos.find(p => p.variant_id === vid);

test('runtime replaces only a photo-added placeholder, once, with an openly licensed Commons JPEG', async () => {
  const pg = await setup(); try {
    assert.equal((await photoOf(pg, 'cooked-ham--cured')).image, PLACEHOLDER);
    await assert.rejects(setImg(pg, 'cooked-ham--cured', { ...info, license: 'All rights reserved' }), /Licence not accepted/);
    await assert.rejects(setImg(pg, 'cooked-ham--cured', { ...info, source_url: 'https://example.com/ham.jpg' }), /Wikimedia Commons/);
    await assert.rejects(setImg(pg, 'cooked-ham--cured', info, Buffer.from('not a jpeg, just text that is long enough'.repeat(40))), /JPEG/);
    await assert.rejects(setImg(pg, 'broccoli--raw'), /Only foods added from photos/);
    assert.equal(await setImg(pg, 'cooked-ham--cured'), 'ingredient-photo-cooked-ham--cured.jpg');
    const p = await photoOf(pg, 'cooked-ham--cured');
    assert.equal(p.image, 'ingredient-photo-cooked-ham--cured.jpg'); assert.equal(p.artist, 'Anna.Massini'); assert.equal(p.license, 'CC BY 4.0'); assert.ok(!('placeholder' in p));
    assert.equal(await setImg(pg, 'cooked-ham--cured', { ...info, artist: 'Someone else' }), 'ingredient-photo-cooked-ham--cured.jpg', 'second call changes nothing');
    assert.equal((await photoOf(pg, 'cooked-ham--cured')).artist, 'Anna.Massini');
    assert.deepEqual(Buffer.from((await pg.query('SELECT colourfuel_catalog.photo_image_bytes($1) b', ['ingredient-photo-cooked-ham--cured.jpg'])).rows[0].b), jpeg);
    await assert.rejects(pg.exec("UPDATE colourfuel_catalog.photo SET image_path='x.jpg'"), /permission denied/);
    await assert.rejects(pg.exec('SELECT * FROM colourfuel_catalog.photo_image'), /permission denied/);
    const c = (await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;
    assert.equal(c.ingredient_photos.length, c.ingredients.length);
    await pg.exec('RESET ROLE'); await assert.rejects(pg.exec(await mig('008_photo_food_images')), /already applied/); await pg.exec('ROLLBACK');
    await pg.exec(await mig('008_photo_food_images.rollback'));
    assert.equal((await photoOf(pg, 'cooked-ham--cured')).image, PLACEHOLDER, 'rollback restores the placeholder');
  } finally { await pg.close(); }
});

test('Commons search keeps only JPEGs with an accepted licence and an author', async () => {
  const page = (title, mime, lic, artist, i) => ({ index: i, title: `File:${title}`, imageinfo: [{ thumburl: `https://upload.wikimedia.org/${i}.jpg`, thumbwidth: 720, thumbheight: 480, url: 'u', descriptionurl: `https://commons.wikimedia.org/wiki/File:${title}`, mime,
    extmetadata: { LicenseShortName: { value: lic }, Artist: { value: artist }, ImageDescription: { value: '<b>Sliced</b> ham' } } }] });
  let seenUA;
  const fetchImpl = async (url, init) => { seenUA = init.headers['User-Agent']; return { ok: true, json: async () => ({ query: { pages: { a: page('Ham.jpg', 'image/jpeg', 'CC BY-SA 4.0', '<a href="x">Jo</a>', 1), b: page('Ham.png', 'image/png', 'CC0', 'Jo', 2), c: page('Ham2.jpg', 'image/jpeg', 'All rights reserved', 'Jo', 3), d: page('Ham3.jpg', 'image/jpeg', 'CC0', '', 4) } } }) }; };
  const out = await searchCommons('ham', { fetchImpl });
  assert.deepEqual(out.map(c => [c.title, c.license, c.artist, c.description]), [['Ham.jpg', 'CC BY-SA 4.0', 'Jo', 'Sliced ham']]);
  assert.match(seenUA, /ColourFuel/); assert.ok(!/@/.test(seenUA), 'no personal contact details');
});

test('attachFoodPhotos skips library foods and real photos; failures keep the placeholder', async () => {
  const catalog = { ingredients: [{ variant_id: 'cooked-ham--cured', name_en: 'Cooked ham', state: 'cured', photo_addition: {} }, { variant_id: 'broccoli--raw', name_en: 'Broccoli' }, { variant_id: 'tofu--raw', name_en: 'Tofu', photo_addition: {} }],
    ingredient_photos: [{ variant_id: 'cooked-ham--cured', image: PLACEHOLDER }, { variant_id: 'broccoli--raw', image: PLACEHOLDER }, { variant_id: 'tofu--raw', image: 'ingredient-photo-tofu--raw.jpg' }] };
  const stored = [];
  const deps = { searchCommons: async () => [{ title: 'Ham.jpg', thumb_url: 't', ...info }], chooseCommonsPhoto: async (f, c) => c[0], downloadJpeg: async () => jpeg, setPhotoFoodImage: async (id, i) => { stored.push([id, i]); return 'p'; } };
  assert.deepEqual(await attachFoodPhotos(['cooked-ham--cured', 'broccoli--raw', 'tofu--raw'], catalog, deps), ['cooked-ham--cured']);
  assert.equal(stored.length, 1); assert.ok(!('thumb_url' in stored[0][1]));
  assert.deepEqual(await attachFoodPhotos(['cooked-ham--cured'], catalog, { ...deps, downloadJpeg: async () => { throw Error('timeout'); } }), []);
  assert.deepEqual(await attachFoodPhotos(['cooked-ham--cured'], catalog, { ...deps, chooseCommonsPhoto: async () => null }), []);
});

test('server serves stored food photos from the database with caching; unknown paths 404', async () => {
  const get = async (url, readPhotoImage) => { const out = {}; await handleRequest({ url, method: 'GET', headers: {} }, { writeHead(s, h) { out.status = s; out.headers = h; }, end(b) { out.body = b; } }, { readPhotoImage }); return out; };
  const ok = await get('/ingredient-photo-cooked-ham--cured.jpg', async p => (p === 'ingredient-photo-cooked-ham--cured.jpg' ? jpeg : null));
  assert.equal(ok.status, 200); assert.equal(ok.headers['Content-Type'], 'image/jpeg'); assert.match(ok.headers['Cache-Control'], /max-age/); assert.deepEqual(ok.body, jpeg);
  assert.equal((await get('/ingredient-photo-unknown--raw.jpg', async () => null)).status, 404);
  assert.equal((await get('/ingredient-photo-../../etc--raw.jpg', async () => jpeg)).status, 404);
  assert.equal((await get('/ingredient-photo-x--raw.jpg', async () => { throw Error('db down'); })).status, 503);
});

test('real pixel size is read from the JPEG, not trusted from the API', () => {
  // SOI, APP0 (length 16), SOF0 with height 537 and width 960.
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
  const sof0 = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x19, 0x03, 0xc0, 0x03]);
  assert.deepEqual(jpegSize(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.alloc(20)])), { width: 960, height: 537 });
  assert.equal(jpegSize(Buffer.from([0xff, 0xd8, 0x00])), null);
});
