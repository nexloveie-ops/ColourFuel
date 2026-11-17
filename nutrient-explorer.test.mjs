import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{prepareMenuCatalog}from'./menu-formulations.mjs';
import{buildNutrientIndex,nutrientRank,rankLabel,foodRankingPanel,foodRankSummary,nutrientAmount}from'./nutrient-explorer.mjs';
const c=prepareMenuCatalog(JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url))));
const m={metric_id:'vitamin_c',name_en:'Vitamin C',unit:'mg'};
const food=(id,value,extra={})=>({variant_id:id,name_en:id,nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'primary_numeric',primary_value:value}],...extra});
test('real catalogue Vitamin C is descending, with broccoli third at 89.2 mg and top 5% of 61 numerical entries',()=>{
 const before=JSON.stringify(c);const index=buildNutrientIndex(c.ingredients,c.metrics);const entry=index.get('vitamin_c');
 const broccoli=nutrientRank(index,'broccoli--raw','vitamin_c');assert.equal(broccoli.value,89.2);assert.equal(broccoli.rank,3);assert.equal(broccoli.total,61);assert.equal(broccoli.topPercent,5);
 assert.equal(entry.coverage.positive,39);assert.equal(entry.coverage.zero,22);assert.equal(entry.coverage.incompatible,1);
 assert.ok(entry.rows.every((r,i)=>i===0||entry.rows[i-1].value>=r.value));assert.equal(entry.rows[0].food.ingredient_id,'red-chilli');
 assert.match(foodRankSummary(c.ingredients.find(i=>i.ingredient_id==='broccoli'),index),/Top 5% in this library/);
 assert.match(foodRankingPanel(c.ingredients[0],index),/not all foods worldwide/);assert.equal(JSON.stringify(c),before);
});
test('ties include the whole tied group in top percentages; sorting uses exact unrounded values',()=>{
 const foods=[food('b',10),food('a',10),food('c',9.9999),food('z',0)];const rows=buildNutrientIndex(foods,[m]).get('vitamin_c').rows;
 assert.deepEqual(rows.map(r=>[r.food.variant_id,r.rank,r.topPercent]),[['a',1,50],['b',1,50],['c',3,75],['z',4,100]]);
 assert.equal(rows[0].tied,2);assert.equal(rankLabel(rows[0]),'Rank 1 of 4 in this library');
 const equal=buildNutrientIndex(Array.from({length:20},(_,i)=>food('f'+i,1)),[m]).get('vitamin_c').rows;
 assert.ok(equal.every(r=>r.rank===1&&r.topPercent===100));assert.doesNotMatch(rankLabel(equal[0]),/Top/);
 const precision=buildNutrientIndex([food('lower',0.00001111),food('higher',0.00001112)],[m]).get('vitamin_c').rows;
 assert.equal(precision[0].food.variant_id,'higher');assert.notEqual(nutrientAmount(precision[0].value),'0');
});
test('zero stays numerical; unknown, trace, limits, negatives, wrong units/basis never enter rankings',()=>{
 const list=[food('positive',10),food('zero',0),food('missing',null),food('negative',-1),food('infinite',Infinity),food('trace',null,{nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'trace_retained'}]}),food('wrong-unit',99,{nutrients:[{metric_id:'vitamin_c',unit:'g',result:'primary_numeric',primary_value:99}]}),food('per-ml',999,{source_basis:'100ml_food'}),food('limit',0,{reported_nutrients:[{metric_id:'vitamin_c',unit:'mg',value:'<0.5'}]})];
 const result=buildNutrientIndex(list,[m]).get('vitamin_c');assert.deepEqual(result.rows.map(r=>r.food.variant_id),['positive','zero']);
 assert.equal(result.coverage.positive,1);assert.equal(result.coverage.zero,1);assert.equal(result.coverage.trace,1);assert.equal(result.coverage.missing,4);assert.equal(result.coverage.incompatible,2);
 assert.equal(Object.entries(result.coverage).filter(([k])=>['known','trace','missing','incompatible','estimatesExcluded'].includes(k)).reduce((n,[,v])=>n+v,0),list.length);
});
test('estimate exclusion recalculates the population and preserves definition, source kind and separate food states',()=>{
 const foods=[food('raw',3),food('cooked',5),food('estimated',null,{nutrients:[{metric_id:'vitamin_c',unit:'mg',result:'reference_imputation',filled_value:8}]}),food('manufacturer',0,{source_basis:'100g_food',reported_nutrients:[{metric_id:'vitamin_c',unit:'mg',value:4},{metric_id:'other-vitamin-c-definition',unit:'mg',value:999}]})];
 const all=buildNutrientIndex(foods,[m]);assert.equal(nutrientRank(all,'estimated','vitamin_c').rank,1);assert.equal(nutrientRank(all,'manufacturer','vitamin_c').kind,'Manufacturer reference');
 const sourceOnly=buildNutrientIndex(foods,[m],{includeEstimates:false});assert.equal(nutrientRank(sourceOnly,'estimated','vitamin_c'),null);assert.equal(nutrientRank(sourceOnly,'cooked','vitamin_c').rank,1);assert.equal(sourceOnly.get('vitamin_c').coverage.estimatesExcluded,1);assert.equal(sourceOnly.get('vitamin_c').coverage.known,3);
 assert.match(foodRankingPanel(food('volume',1,{source_basis:'100ml_food'}),all),/ranking unavailable/);
});
