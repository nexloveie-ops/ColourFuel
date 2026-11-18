import {persistentFixture} from './fixtures/catalog-presentation.mjs';
import test,{after} from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{PGlite}from'@electric-sql/pglite';
import{prepareMenuCatalog}from'./fixtures/prepare-test-catalog.mjs';
import{prepareWebCatalog}from'./web-catalog.mjs';
import{NUTRIENT_RANKING_SQL}from'./nutrient-ranking-query.mjs';
import{hydrateNutrientIndex,nutrientRank,rankLabel,foodRankingPanel,foodRankSummary,nutrientAmount}from'./nutrient-explorer.mjs';
const pg=new PGlite();after(()=>pg.close());
const live=JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)));
const c=prepareMenuCatalog(live);
const m={metric_id:'vitamin_c',name_en:'Vitamin C',unit:'mg'};
const food=(id,value,extra={})=>({variant_id:id,name_en:id,nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'primary_numeric',primary_value:value}],...extra});
async function sqlCatalog(ingredients,metrics){const catalog={ingredients,metrics,read_at:'2026-11-17T00:00:00Z'};const result=await pg.query(NUTRIENT_RANKING_SQL,[JSON.stringify(catalog)]);return {...catalog,nutrient_rankings:result.rows[0].rankings};}
async function index(foods,metrics,options){return hydrateNutrientIndex(await sqlCatalog(foods,metrics),options);}
test('PostgreSQL computes the real catalogue ranking, including broccoli seventh and top 7% of 111 after expansion',async()=>{
 const before=JSON.stringify(c);const rows=await index(c.ingredients,c.metrics);const entry=rows.get('vitamin_c');
 const broccoli=nutrientRank(rows,'broccoli--raw','vitamin_c');assert.equal(broccoli.value,89.2);assert.equal(broccoli.rank,7);assert.equal(broccoli.total,111);assert.equal(broccoli.topPercent,7);
 assert.equal(entry.coverage.positive,88);assert.equal(entry.coverage.zero,23);assert.equal(entry.coverage.incompatible,1);
 assert.ok(entry.rows.every((r,i)=>i===0||entry.rows[i-1].value>=r.value));assert.equal(entry.rows[0].food.ingredient_id,'thyme');
 assert.match(foodRankSummary(c.ingredients.find(i=>i.ingredient_id==='broccoli'),rows),/Top 7% in this library/);
 assert.match(foodRankingPanel(c.ingredients[0],rows),/not all foods worldwide/);assert.equal(JSON.stringify(c),before);
});
test('PostgreSQL ties use the entire peer group and exact numeric ordering',async()=>{
 const rows=(await index([food('b',10),food('a',10),food('c',9.9999),food('z',0)],[m])).get('vitamin_c').rows;
 assert.deepEqual(rows.map(r=>[r.food.variant_id,r.rank,r.topPercent]),[['a',1,50],['b',1,50],['c',3,75],['z',4,100]]);
 assert.equal(rows[0].tied,2);assert.equal(rankLabel(rows[0]),'Rank 1 of 4 in this library');
 const equal=(await index(Array.from({length:20},(_,i)=>food('f'+i,1)),[m])).get('vitamin_c').rows;
 assert.ok(equal.every(r=>r.rank===1&&r.topPercent===100));assert.doesNotMatch(rankLabel(equal[0]),/Top/);
 const precision=(await index([food('lower',0.00001111),food('higher',0.00001112)],[m])).get('vitamin_c').rows;
 assert.equal(precision[0].food.variant_id,'higher');assert.notEqual(nutrientAmount(precision[0].value),'0');
 // Exact numeric arithmetic avoids floating-point ceil turning a true 7% into 8%.
 const hundred=(await index(Array.from({length:100},(_,i)=>food('f'+i,100-i)),[m])).get('vitamin_c').rows;assert.equal(hundred[6].topPercent,7);
});
test('SQL retains known zero but excludes unknowns, traces, limits, negatives and incompatible units/bases',async()=>{
 const list=[food('positive',10),food('zero',0),food('missing',null),food('negative',-1),food('infinite',Infinity),food('trace',null,{nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'trace_retained'}]}),food('wrong-unit',99,{nutrients:[{metric_id:'vitamin_c',unit:'g',result:'primary_numeric',primary_value:99}]}),food('per-ml',999,{source_basis:'100ml_food'}),food('limit',0,{reported_nutrients:[{metric_id:'vitamin_c',unit:'mg',value:'<0.5'}]})];
 const result=(await index(list,[m])).get('vitamin_c');assert.deepEqual(result.rows.map(r=>r.food.variant_id),['positive','zero']);
 assert.equal(result.coverage.positive,1);assert.equal(result.coverage.zero,1);assert.equal(result.coverage.trace,1);assert.equal(result.coverage.missing,4);assert.equal(result.coverage.incompatible,2);
 assert.equal(Object.entries(result.coverage).filter(([k])=>['known','trace','missing','incompatible','estimatesExcluded'].includes(k)).reduce((n,[,v])=>n+v,0),list.length);
});
test('database provides both estimate policies; browser only selects the returned result set',async()=>{
 const foods=[food('raw',3),food('cooked',5),food('estimated',null,{nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'reference_imputation',filled_value:8}]}),food('manufacturer',0,{source_basis:'100g_food',reported_nutrients:[{metric_id:'vitamin_c',unit:'mg',value:4},{metric_id:'other-vitamin-c-definition',unit:'mg',value:999}]})];
 const payload=await sqlCatalog(foods,[m]);const all=hydrateNutrientIndex(payload);assert.equal(nutrientRank(all,'estimated','vitamin_c').rank,1);assert.equal(nutrientRank(all,'manufacturer','vitamin_c').kind,'Manufacturer reference');
 const sourceOnly=hydrateNutrientIndex(payload,{includeEstimates:false});assert.equal(nutrientRank(sourceOnly,'estimated','vitamin_c'),null);assert.equal(nutrientRank(sourceOnly,'cooked','vitamin_c').rank,1);assert.equal(sourceOnly.get('vitamin_c').coverage.estimatesExcluded,1);assert.equal(sourceOnly.get('vitamin_c').coverage.known,3);
 assert.match(foodRankingPanel(food('volume',1,{source_basis:'100ml_food'}),all),/ranking unavailable/);
 assert.throws(()=>hydrateNutrientIndex({...payload,read_at:'changed-snapshot'}),/unavailable/);
 assert.throws(()=>hydrateNutrientIndex({...payload,nutrient_rankings:null}),/unavailable/);
});
test('server unifies source-backed additions and recalculates from changed data, using a read-only SQL statement',async()=>{
 const query=(text,args)=>pg.query(text,args);
 const first=await prepareWebCatalog(persistentFixture(live),query);assert.equal(first.catalog_preparation,'server');assert.equal(first.ingredients.length,114);assert.equal(first.local_supplement_count,0);
 const prior=nutrientRank(hydrateNutrientIndex(first),'broccoli--raw','vitamin_c');assert.equal(prior.rank,7);
 const changed=persistentFixture(live);changed.ingredients.find(i=>i.ingredient_id==='broccoli').nutrients.find(n=>n.metric_id==='vitamin_c').primary_value=200;
 const second=await prepareWebCatalog(changed,query);assert.equal(nutrientRank(hydrateNutrientIndex(second),'broccoli--raw','vitamin_c').rank,1);assert.equal(prior.rank,7);
 await pg.exec('BEGIN READ ONLY');try{const readonly=await prepareWebCatalog(persistentFixture(live),query);assert.equal(readonly.nutrient_rankings.engine,'postgresql-window-functions');}finally{await pg.exec('ROLLBACK');}
 await assert.rejects(prepareWebCatalog(persistentFixture(live),async()=>({rows:[]})),/Invalid database rankings/);
});
