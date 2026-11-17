import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {IRISH_INGREDIENT_ADDITIONS} from './irish-ingredient-expansion.mjs';
import {IRISH_BUYING_REFERENCES} from './irish-shopping.mjs';
import {prepareMenuCatalog} from './menu-formulations.mjs';
import {calculate} from './recipe-engine.mjs';
const live=JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)));
test('50 distinct source-matched foods have independently attributable Irish buying evidence',()=>{
 assert.equal(IRISH_INGREDIENT_ADDITIONS.length,50);
 const c=prepareMenuCatalog(live);assert.equal(c.ingredients.length,114);assert.equal(new Set(c.ingredients.map(f=>f.variant_id)).size,114);
 assert.equal(new Set(IRISH_INGREDIENT_ADDITIONS.map(f=>f.ingredient_id)).size,50);
 for(const f of IRISH_INGREDIENT_ADDITIONS){
  assert.ok(!live.ingredients.some(old=>old.ingredient_id===f.ingredient_id));assert.equal(f.dataset_id,'usda_sr_legacy_2018_04');assert.equal(f.source_basis,'100g_food');assert.equal(f.nutrients.length,c.metrics.length);
  assert.equal(new Set(f.nutrients.map(n=>n.metric_id)).size,c.metrics.length);
  assert.equal(f.source_url,`https://fdc.nal.usda.gov/food-details/${f.source_food_id}/nutrients`);
  const refs=IRISH_BUYING_REFERENCES.filter(r=>r.ingredient_id===f.ingredient_id);assert.ok(refs.length);assert.ok(refs.every(r=>r.evidence_type==='product'&&r.reviewed_on==='2026-11-17'));
  for(const n of f.nutrients){assert.equal(n.unit,c.metrics.find(m=>m.metric_id===n.metric_id).unit);if(n.result==='missing')assert.equal(n.primary_value,null);else assert.ok(Number.isFinite(n.primary_value??n.filled_value)&&(n.primary_value??n.filled_value)>=0);}
 }
});
test('culinary state, cultivar references, missing micronutrients and recipe arithmetic remain explicit',()=>{
 const c=prepareMenuCatalog(live),food=id=>c.ingredients.find(f=>f.ingredient_id===id),val=(id,metric)=>food(id).nutrients.find(n=>n.metric_id===metric);
 assert.equal(val('kiwi','vitamin_c').primary_value,92.7);assert.equal(val('parsley','vitamin_c').primary_value,133);
 assert.equal(val('kiwi','iodine').primary_value,null);assert.equal(val('kiwi','iodine').result,'missing');
 assert.equal(food('bulgur').state,'dry');assert.match(food('bulgur').edible_description,/Cooked weight must use a separate record/);
 assert.equal(food('beetroot').state,'boiled');assert.match(food('coconut').edible_description,/water excluded/);
 const pod=food('edible-pod-pea');assert.equal(pod.verification_status,'reference_estimate');assert.ok(pod.nutrients.filter(n=>n.primary_value!=null||n.filled_value!=null).every(n=>n.result==='reference_imputation'));
 const recipe={title:'Kiwi reference check',servings:1,items:[{variant_id:food('kiwi').variant_id,grams:50}]};const result=calculate(recipe,c);assert.equal(result.metrics.vitamin_c.perServing,46.35);assert.equal(result.metrics.iodine.perServing,null);
 const again=prepareMenuCatalog(c);assert.equal(again.ingredients.length,114);assert.equal(new Set(again.ingredients.map(f=>f.variant_id)).size,114);
});
