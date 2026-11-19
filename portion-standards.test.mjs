import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareMenuCatalog} from './fixtures/prepare-test-catalog.mjs';
import {portionStandard,sauceStandard,portionCount,isStandardCount,portionGrams,changePortion,resizeBatch,portionPricing,demoFoodStandard,demoSauceStandard} from './portion-standards.mjs';
import {fromCatalog,calculate,encodeShare,decodeShare,applyPreset,validateRecipe,passport} from './recipe-engine.mjs';
const catalog=prepareMenuCatalog(JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url))));
const bowl=id=>fromCatalog(catalog.recipes.find(r=>r.bowl_product_id===id));
const food=id=>catalog.ingredients.find(i=>i.variant_id===id);
test('all eight v2 Bowl originals and 16 presets fit the shared standards',()=>{
 const bowls=catalog.recipes.filter(r=>r.bowl_product_id);assert.equal(bowls.length,8);
 for(const r of bowls){assert.equal(r.version,2);const original=fromCatalog(r);for(const current of [original,...catalog.presets.filter(p=>p.recipe_id===r.recipe_id).map(p=>applyPreset(original,p,catalog))])for(const row of current.items){const standard=portionStandard(food(row.variant_id));assert.ok(isStandardCount(portionCount(row.grams,current.servings,standard),standard),row.variant_id);}}
});
test('a half grain portion changes exactly 25 g; protein uses full 50 g units',()=>{
 const original=bowl('everyday-chicken');const rice=changePortion(original,'brown-rice--cooked',3.5,food('brown-rice--cooked'));assert.equal(rice.items.find(i=>i.variant_id==='brown-rice--cooked').grams,175);
 const protein=changePortion(original,'chicken-breast--roasted',3,food('chicken-breast--roasted'));assert.equal(protein.items.find(i=>i.variant_id==='chicken-breast--roasted').grams,150);assert.equal(original.items.find(i=>i.variant_id==='chicken-breast--roasted').grams,100);
 assert.throws(()=>changePortion(original,'chicken-breast--roasted',2.5,food('chicken-breast--roasted')),/steps/);
 assert.throws(()=>portionGrams(NaN,1,portionStandard(food('chicken-breast--roasted'))));assert.throws(()=>portionGrams(5,1,portionStandard(food('chicken-breast--roasted'))));
});
test('batch scaling preserves per-bowl nutrition, sauce, standards and the comparison original',()=>{
 const original=bowl('rainbow-chicken');original.sauce={id:'classic-caesar',grams:30};const batch=resizeBatch(original,3);validateRecipe(batch,catalog);
 assert.equal(batch.items.find(i=>i.variant_id==='chicken-breast--roasted').grams,300);assert.equal(batch.sauce.grams,90);assert.equal(original.sauce.grams,30);
 assert.equal(calculate(batch,catalog,{includeSauce:false}).metrics.protein.perServing,calculate(original,catalog,{includeSauce:false}).metrics.protein.perServing);
 assert.equal(calculate(batch,catalog).metrics.protein.perServing,null);assert.deepEqual(resizeBatch(batch,1).items,original.items);
 const report=passport(original,batch,catalog);assert.equal(report.standard_portions.bowls,3);assert.equal(report.standard_portions.rows.find(r=>r.variant_id==='chicken-breast--roasted').portions_per_bowl,2);assert.equal(report.standard_portions.rows.at(-1).batch_grams,90);
 assert.throws(()=>resizeBatch(original,13));assert.throws(()=>resizeBatch({...original,servings:2,items:[{variant_id:'chicken-breast--roasted',grams:125.5}]},3),/cannot scale exactly/);assert.throws(()=>resizeBatch({...original,items:[{variant_id:'chicken-breast--roasted',grams:300}]},12),/2,000/);
});
test('unknown pricing stays unknown; verified unit costs and customer charges are independent',()=>{
 const original=bowl('everyday-chicken');original.sauce={id:'citrus-mint',grams:25};const current=changePortion(original,'chicken-breast--roasted',3,food('chicken-breast--roasted'));
 const pending=portionPricing(original,current,catalog.ingredients,catalog.sauces,795);assert.equal(pending.ingredientCostCents,null);assert.equal(pending.targetPriceCents,null);
 // Synthetic financial fixtures only: a 50 g protein unit costs 60 cents, but an extra sells at 150 cents.
 const standard=f=>({...portionStandard(f),pricingStatus:'verified',costCents:f.ingredient_id==='chicken-breast'?60:10,extraPriceCents:150,removalCreditCents:0});
 const priced=portionPricing(original,current,catalog.ingredients,catalog.sauces,795,{foodStandard:standard,saucePortion:s=>({...sauceStandard(s),pricingStatus:'verified',costCents:10,extraPriceCents:50,removalCreditCents:0})});assert.equal(priced.targetPriceCents,945);assert.equal(priced.ingredientCostCents,260);
 const removed=changePortion(original,'broccoli--raw',0,food('broccoli--raw'));assert.equal(portionPricing(original,removed,catalog.ingredients,catalog.sauces,795).targetPriceCents,null);
});
test('required sauce uses whole cups and legacy shared weights are never silently rounded',()=>{
 const sauce=sauceStandard(catalog.sauces.find(s=>s.id==='citrus-mint'));assert.equal(portionGrams(2,3,sauce,{required:true}),150);assert.throws(()=>portionGrams(0,1,sauce,{required:true}));
 const legacy=bowl('everyday-chicken');legacy.items[0].grams=80;legacy.sauce={id:'citrus-mint',grams:25};const decoded=decodeShare(encodeShare(legacy,legacy,catalog),catalog).current;assert.equal(decoded.items[0].grams,80);assert.equal(isStandardCount(portionCount(80,1,portionStandard(food('chicken-breast--roasted'))),portionStandard(food('chicken-breast--roasted'))),false);
});

test('demo charges require explicit opt-in and never verify ingredient costs',()=>{
 const original=bowl('rainbow-chicken');let current=changePortion(original,'chicken-breast--roasted',3,food('chicken-breast--roasted'));current=changePortion(current,'quinoa--cooked',2.5,food('quinoa--cooked'));current.sauce={id:'classic-caesar',grams:60};
 const options={foodStandard:demoFoodStandard,saucePortion:demoSauceStandard};
 assert.equal(portionPricing(original,current,catalog.ingredients,catalog.sauces,895,options).targetPriceCents,null);
 const demo=portionPricing(original,current,catalog.ingredients,catalog.sauces,895,{...options,allowDemo:true});
 assert.equal(demo.targetPriceCents,1125);assert.equal(demo.adjustmentCents,230);assert.equal(demo.ingredientCostCents,null);assert.equal(demo.pricingMode,'demo');assert.deepEqual(demo.lines.map(l=>l.amountCents),[150,30,50]);
 const batch=portionPricing(original,resizeBatch(current,3),catalog.ingredients,catalog.sauces,895,{...options,allowDemo:true});assert.equal(batch.targetPriceCents,1125);assert.equal(batch.targetPriceCents*3,3375);
});
test('demo removals do not discount the base; one sauce portion is included',()=>{
 const original=bowl('rainbow-chicken');const current=changePortion(original,'broccoli--raw',0,food('broccoli--raw'));current.sauce={id:'citrus-mint',grams:25};
 const demo=portionPricing(original,current,catalog.ingredients,catalog.sauces,895,{foodStandard:demoFoodStandard,saucePortion:demoSauceStandard,allowDemo:true});assert.equal(demo.targetPriceCents,895);assert.equal(demo.lines[0].amountCents,0);assert.equal(demo.lines.some(l=>l.id.startsWith('sauce:')),false);assert.equal(portionStandard(food('chicken-breast--roasted')).pricingStatus,'pending');
});
