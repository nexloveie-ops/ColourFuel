import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareMenuCatalog} from './fixtures/prepare-test-catalog.mjs';
import {sauceIngredientIds} from './sauce-content.mjs';
import {PRODUCTS} from './product-content.mjs';
import {fromCatalog,calculate,requireSauce,encodeShare,decodeShare,applyPreset} from './recipe-engine.mjs';
const live=JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)));
const c=prepareMenuCatalog(live);
test('all eight bowls have editable sourced quantities without changing the live snapshot',()=>{
 assert.equal(PRODUCTS.length,8);assert.equal(live.ingredients.length,32);assert.equal(c.ingredients.length,114);
 for(const p of PRODUCTS){const r=fromCatalog(c.recipes.find(r=>r.recipe_id===p.recipe_id));assert.ok(r.items.length>=6);for(const row of r.items){assert.ok(row.grams>0);const i=c.ingredients.find(i=>i.variant_id===row.variant_id);assert.ok(i.source_food_id);assert.ok(i.nutrients.length)}assert.ok(calculate(r,c,{includeSauce:false}).metrics.energy_reported.perServing>0);assert.equal(calculate(r,c).metrics.energy_reported.perServing,null);assert.throws(()=>requireSauce(r,c),/required sauce/);}
});
test('every sauce can be chosen, weights survive sharing, and unknown sauce nutrients cannot become zero',()=>{
 const original=fromCatalog(c.recipes.find(r=>r.bowl_product_id==='coastal-colour'));
 for(const s of c.sauces){const current={...original,sauce:{id:s.id,grams:s.default_grams}};requireSauce(current,c);const restored=decodeShare(encodeShare(original,current,c),c).current;assert.deepEqual(restored.sauce,current.sauce);assert.equal(calculate(restored,c).metrics.energy_reported.perServing,null);assert.equal(calculate(restored,c).weight,original.items.reduce((n,i)=>n+i.grams,0)+s.default_grams);}
 assert.throws(()=>requireSauce({...original,sauce:{id:c.sauces[0].id,grams:0}},c));
});
test('existing reviewed presets remain usable with mandatory unquantified sauces',()=>{for(const p of c.presets){const original=fromCatalog(c.recipes.find(r=>r.recipe_id===p.recipe_id));assert.equal(applyPreset(original,p,c).mode,'Goal Preset')}});
test('per-100ml manufacturer records are never treated as per-100g inputs; pork reference stays explicit',()=>{
 const vinegar=c.ingredients.find(i=>i.variant_id==='rice-vinegar--ready_to_use');assert.equal(vinegar.source_basis,'100ml_food');assert.equal(vinegar.nutrients.length,0);assert.ok(vinegar.reported_nutrients.length);
 const pork=c.ingredients.find(i=>i.variant_id==='pork-shavings--cooked');assert.ok(pork.nutrients.filter(n=>n.primary_value!=null||n.filled_value!=null).every(n=>n.result==='reference_imputation'));
});

test('all suggested sauce ingredients open an existing source-linked library record',()=>{for(const id of Object.values(sauceIngredientIds))assert.ok(c.ingredients.some(i=>i.variant_id===id))});

test('each Bowl has both usable presets with a real base-nutrient increase; sauce is preserved',()=>{
 for(const p of PRODUCTS){const r=fromCatalog(c.recipes.find(r=>r.recipe_id===p.recipe_id));r.sauce={id:c.sauces[0].id,grams:30};const presets=c.presets.filter(p=>p.recipe_id===r.source_recipe_id);assert.deepEqual(presets.map(p=>p.label).sort(),['Active Day','Protein+']);for(const preset of presets){const next=applyPreset(r,preset,c);assert.deepEqual(next.sauce,r.sauce);assert.ok(calculate(next,c,{includeSauce:false}).metrics[preset.goal_metric].perServing>calculate(r,c,{includeSauce:false}).metrics[preset.goal_metric].perServing);}}
});

test('served products match the fixed Bowl menu, replacing legacy database product rows',()=>{
 assert.deepEqual(c.products.map(p=>[p.product_id,p.name,p.illustrative_price_cents,p.rd]),PRODUCTS.map(p=>[p.product_id,p.name,p.illustrative_price_cents,p.rd]));
 assert.ok(!c.products.some(p=>p.product_id==='vegan-power'));
 assert.equal(c.products.find(p=>p.product_id==='rainbow-chicken').illustrative_price_cents,895);
});
