import {prepareWebCatalog} from './web-catalog.mjs';
import {hydrateNutrientIndex} from './nutrient-explorer.mjs';
import {hydrateIngredientPhotos,INGREDIENT_PHOTOS} from './ingredient-photos.mjs';
import {hydrateIrishShopping,IRISH_BUYING_REFERENCES} from './irish-shopping.mjs';
import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';import{NUTRIENT_RANKING_SQL}from'./nutrient-ranking-query.mjs';
const source=JSON.parse(await readFile(new URL('./fixtures/persistent-catalog-source.json',import.meta.url)));
const originalSQL=await readFile(new URL('./migrations/006_persistent_catalog.sql',import.meta.url),'utf8');
const sql=originalSQL.replaceAll("current_database()<>'colourfuel'","current_database()<>'postgres'");
const rollback=(await readFile(new URL('./migrations/006_persistent_catalog.rollback.sql',import.meta.url),'utf8')).replaceAll("current_database()<>'colourfuel'","current_database()<>'postgres'");
const legacy={...JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url))),ingredients:source.ingredients.slice(0,32)};
const quote=s=>"'"+JSON.stringify(s).replaceAll("'","''")+"'";
async function setup(){const pg=new PGlite();await pg.exec(`CREATE SCHEMA colourfuel;CREATE TABLE colourfuel.schema_migration(migration_id text PRIMARY KEY,details jsonb);CREATE SCHEMA colourfuel_web;CREATE VIEW colourfuel_web.catalog AS SELECT ${quote(legacy)}::jsonb AS payload;CREATE ROLE "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";GRANT USAGE ON SCHEMA colourfuel_web TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";GRANT SELECT ON colourfuel_web.catalog TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";`);return pg;}
function canon(food){const f=structuredClone(food);delete f.local_supplement;delete f.database_record;f.source_basis??='100g_food';f.reported_nutrients??=[];for(const n of f.nutrients){n.primary_value??=null;n.filled_value??=null;}return f;}
test('transaction migrates all records, exact nutrients, provenance, photos, retailers and buying references',async()=>{
 const pg=await setup();try{
  await pg.exec(sql);const actual=(await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;
  assert.equal(actual.ingredients.length,114);assert.equal(actual.local_supplement_count,0);assert.equal(actual.catalog_persistence.storage,'cloud-sql-tables');
  for(const original of source.ingredients){const actualFood=actual.ingredients.find(f=>f.variant_id===original.variant_id);assert.equal(actualFood.database_record,true);assert.equal('reported_nutrients' in actualFood,'reported_nutrients' in original);assert.deepEqual(canon(actualFood),canon(original));}
  assert.deepEqual(actual.metrics,source.metrics);assert.deepEqual([...actual.datasets].sort((a,b)=>a.dataset_id.localeCompare(b.dataset_id)),[...source.datasets].sort((a,b)=>a.dataset_id.localeCompare(b.dataset_id)));
  assert.deepEqual(actual.irish_buying_references,source.buying_references);assert.deepEqual(actual.irish_retailers,source.retailers);
  assert.deepEqual([...actual.ingredient_photos].sort((a,b)=>a.variant_id.localeCompare(b.variant_id)),[...source.photos].sort((a,b)=>a.variant_id.localeCompare(b.variant_id)));
  assert.deepEqual(actual.recipes,legacy.recipes);assert.deepEqual(actual.products,legacy.products);
  const again=sql;await assert.rejects(pg.exec(again),/already applied/);await pg.exec('ROLLBACK');assert.equal((await pg.query('SELECT count(*)::int n FROM colourfuel_catalog.variant')).rows[0].n,114);
 }finally{await pg.close();}
});
test('database changes affect the returned amounts and PostgreSQL ranks without file merging; runtime remains read-only',async()=>{
 const pg=await setup();try{
  await pg.exec(sql);await pg.exec("UPDATE colourfuel_catalog.observation SET primary_value=200 WHERE variant_id='kiwi--raw' AND metric_id='vitamin_c';UPDATE colourfuel_catalog.variant SET name_en='Green kiwi — database edit' WHERE variant_id='kiwi--raw'");
  const c=(await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;assert.equal(c.ingredients.find(f=>f.variant_id==='kiwi--raw').name_en,'Green kiwi — database edit');
  const prepared=await prepareWebCatalog(c,(text,args)=>pg.query(text,args));assert.equal(prepared.ingredients.find(f=>f.variant_id==='kiwi--raw').nutrients.find(n=>n.metric_id==='vitamin_c').primary_value,200);assert.equal(hydrateNutrientIndex(prepared).get('vitamin_c').rows[0].food.variant_id,'kiwi--raw');hydrateIngredientPhotos(prepared);hydrateIrishShopping(prepared);assert.equal(Object.keys(INGREDIENT_PHOTOS).length,114);assert.equal(IRISH_BUYING_REFERENCES.length,120);const rankings=prepared.nutrient_rankings;assert.equal(rankings.with_estimates.find(m=>m.metric_id==='vitamin_c').rows[0].variant_id,'kiwi--raw');
  await pg.exec('SET ROLE "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam"');assert.equal((await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload.ingredients.length,114);await assert.rejects(pg.exec('INSERT INTO colourfuel_catalog.ingredient VALUES (\'x\',\'x\',\'vegetable\')'),/permission denied/);await pg.exec('RESET ROLE');
  await pg.exec(rollback);assert.equal((await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload.ingredients.length,32);assert.equal((await pg.query('SELECT count(*)::int n FROM colourfuel_catalog.variant')).rows[0].n,114);
 }finally{await pg.close();}
});
test('wrong database or changed source aborts without a partial schema or modified catalogue',async()=>{
 const pg=await setup();try{await assert.rejects(pg.exec(originalSQL),/Wrong database/);await pg.exec('ROLLBACK');assert.equal((await pg.query("SELECT to_regnamespace('colourfuel_catalog')::text name")).rows[0].name,null);
  const changed=structuredClone(legacy);changed.ingredients[0].nutrients[0].primary_value=999;await pg.exec(`CREATE OR REPLACE VIEW colourfuel_web.catalog AS SELECT ${quote(changed)}::jsonb payload`);await assert.rejects(pg.exec(sql),/Nutrition changed since capture/);await pg.exec('ROLLBACK');assert.equal((await pg.query("SELECT to_regnamespace('colourfuel_catalog')::text name")).rows[0].name,null);
 }finally{await pg.close();}
});

test('server fails closed without migration and rejects incomplete database presentation data',async()=>{
 await assert.rejects(prepareWebCatalog(legacy,async()=>{throw Error('must not query');}),/Persistent ingredient catalogue unavailable/);
 const pg=await setup();try{await pg.exec(sql);const c=(await pg.query('SELECT payload FROM colourfuel_web.catalog')).rows[0].payload;
 await assert.rejects(prepareWebCatalog({...c,ingredient_photos:[]},()=>pg.query('SELECT 1')),/photos incomplete/);
 await assert.rejects(prepareWebCatalog({...c,ingredients:c.ingredients.map(f=>({...f,database_record:false}))},()=>pg.query('SELECT 1')),/Invalid persistent/);
 }finally{await pg.close();}
});
