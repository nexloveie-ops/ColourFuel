import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareMenuCatalog} from './menu-formulations.mjs';
import {browseIngredients,ingredientGroup} from './ingredient-library.mjs';
const foods=prepareMenuCatalog(JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)))).ingredients;
test('all 64 preparation variants appear once in ordered food groups',()=>{
 const {groups,counts}=browseIngredients(foods);
 assert.equal(groups.length,9);assert.equal(counts.all,64);
 const ids=groups.flatMap(g=>g.items.map(i=>i.variant_id));
 assert.equal(ids.length,64);assert.equal(new Set(ids).size,64);
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
