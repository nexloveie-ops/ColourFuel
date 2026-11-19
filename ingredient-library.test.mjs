import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareMenuCatalog} from './fixtures/prepare-test-catalog.mjs';
import {browseIngredients,ingredientGroup} from './ingredient-library.mjs';
const foods=prepareMenuCatalog(JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)))).ingredients;
test('all 114 preparation variants appear once in ordered food groups',()=>{
 const {groups,counts}=browseIngredients(foods);
 assert.equal(groups.length,9);assert.equal(counts.all,114);
 const ids=groups.flatMap(g=>g.items.map(i=>i.variant_id));
 assert.equal(ids.length,114);assert.equal(new Set(ids).size,114);
 assert.equal(ingredientGroup(foods.find(i=>i.ingredient_id==='tahini')),'pantry');
 assert.equal(ingredientGroup(foods.find(i=>i.ingredient_id==='chipotle')),'herbs-spices');
 assert.equal(ingredientGroup(foods.find(i=>i.ingredient_id==='firm-tofu')),'plant-protein');
});
test('search and category work together, with counts available for changing filters',()=>{
 const result=browseIngredients(foods,{query:'  ORANGE ',category:'fruit'});
 assert.equal(result.groups.length,1);assert.equal(result.groups[0].items.length,2);assert.equal(result.counts.fruit,2);
 assert.equal(browseIngredients(foods,{query:'orange',category:'dairy'}).groups.length,0);
 const alias=foods.find(i=>i.aliases?.some(a=>!i.name_en.toLowerCase().includes(a.toLowerCase())));
 const term=alias.aliases.find(a=>!alias.name_en.toLowerCase().includes(a.toLowerCase()));
 assert.ok(browseIngredients(foods,{query:term}).groups.flatMap(g=>g.items).some(i=>i.variant_id===alias.variant_id));
 assert.equal(browseIngredients(foods,{category:'animal-protein'}).groups[0].items.filter(i=>i.ingredient_id==='chicken-breast').length,2);
});

test('Bowl add-on options are grouped and exclude raw proteins, condiments and foods needing cooking',async()=>{
 const {groupedIngredientOptions}=await import('./ingredient-library.mjs');
 const foods=[{variant_id:'chicken-breast--raw',ingredient_id:'chicken-breast',category:'meat',state:'raw',name_en:'Chicken breast'},{variant_id:'chicken-breast--roasted',ingredient_id:'chicken-breast',category:'meat',state:'roasted',name_en:'Chicken breast'},{variant_id:'water--ready_to_use',ingredient_id:'water',category:'water',state:'ready_to_use',name_en:'Water'},{variant_id:'potato--raw',ingredient_id:'potato',category:'vegetable',state:'raw',name_en:'Potato'},{variant_id:'kale--raw',ingredient_id:'kale',category:'vegetable',state:'raw',name_en:'Kale'},{variant_id:'avocado--raw',ingredient_id:'avocado',category:'fruit',state:'raw',name_en:'Avocado'},{variant_id:'oat--dry',ingredient_id:'oat',category:'grain',state:'dry',name_en:'Oats'}];
 const bowl=groupedIngredientOptions(foods,{bowl:true}),ids=bowl.flatMap(g=>g.items.map(i=>i.variant_id));
 assert.deepEqual(ids.sort(),['avocado--raw','chicken-breast--roasted','kale--raw']);
 assert.deepEqual(bowl.map(g=>g.label),['Vegetables','Fruit & juices','Meat, fish & eggs']);
 assert.equal(groupedIngredientOptions(foods).flatMap(g=>g.items).length,foods.length);
});
