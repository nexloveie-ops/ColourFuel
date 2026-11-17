import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareMenuCatalog} from './menu-formulations.mjs';
import {IRISH_RETAILERS,IRISH_BUYING_REFERENCES,buyingOptions,buyingPanel,ingredientsAtRetailer,retailerGuide} from './irish-shopping.mjs';
import {browseIngredients} from './ingredient-library.mjs';
const foods=prepareMenuCatalog(JSON.parse(await readFile(new URL('./fixtures/catalog-test-snapshot.json',import.meta.url)))).ingredients;
test('all 114 preparation variants have Irish buying evidence without changing their nutritional records',()=>{
 const before=JSON.stringify(foods);
 assert.equal(foods.length,114);assert.equal(new Set(foods.map(i=>i.ingredient_id)).size,112);
 assert.equal(IRISH_BUYING_REFERENCES.length,120);
 for(const food of foods){assert.ok(buyingOptions(food).length,food.variant_id);assert.match(buyingPanel(food),/do not supply the nutrition figures/);}
 assert.equal(JSON.stringify(foods),before);
});
test('retail links have attributable merchants, reviewed dates and separate product/range evidence',()=>{
 const hosts=new Set(['www.tesco.ie','www.aldi.ie','www.lidl.ie','shop.supervalu.ie','www.hollandandbarrett.ie','www.picadomexican.com','thevillagebutcher.ie']);
 const keys=new Set();
 for(const ref of IRISH_BUYING_REFERENCES){
  assert.ok(foods.some(food=>food.ingredient_id===ref.ingredient_id));
  const retailer=IRISH_RETAILERS.find(shop=>shop.id===ref.retailer_id);assert.ok(retailer&&!retailer.directory_only);
  const url=new URL(ref.url);assert.equal(url.protocol,'https:');assert.ok(hosts.has(url.hostname));
  assert.equal(ref.reviewed_on,'2026-11-17');assert.ok(ref.product&&ref.pack);
  const key=ref.ingredient_id+ref.url;assert.ok(!keys.has(key));keys.add(key);
  assert.ok(['ingredient','prepare','alternative'].includes(ref.match));assert.ok(['product','range'].includes(ref.evidence_type));
  assert.equal('stock' in ref,false);assert.equal('price' in ref,false);assert.equal('nutrients' in ref,false);
 }
 const guide=retailerGuide();assert.match(guide,/M&amp;S and Donnybrook Fair|M&S and Donnybrook Fair/);
 assert.ok(IRISH_RETAILERS.find(s=>s.id==='marks-spencer').directory_only);
 assert.ok(IRISH_RETAILERS.find(s=>s.id==='donnybrook-fair').directory_only);
 assert.equal(IRISH_BUYING_REFERENCES.find(r=>r.retailer_id==='lidl').evidence_type,'range');
});
test('prepared weights, raw juices and manufacturer alternatives retain their matching caveats',()=>{
 const option=id=>buyingOptions(foods.find(food=>food.ingredient_id===id));
 for(const id of ['brown-rice','quinoa','kidney-bean','edamame','tuna','sesame-seed','pork-shavings','lemon-juice','lime-juice'])assert.ok(option(id).every(r=>r.match==='prepare'&&r.note.length>30),id);
 for(const id of ['dijon-mustard','rice-vinegar','chipotle'])assert.ok(option(id).every(r=>r.match==='alternative'&&r.note.length>30));
 assert.ok(option('orange-juice').some(r=>r.match==='prepare'));assert.ok(option('orange-juice').some(r=>r.match==='alternative'));
 const raw=foods.find(f=>f.variant_id==='chicken-breast--raw');const cooked=foods.find(f=>f.variant_id==='chicken-breast--roasted');
 assert.deepEqual(buyingOptions(raw),buyingOptions(cooked));assert.match(buyingPanel(cooked),/Sold raw/);
 assert.match(buyingPanel({ingredient_id:'not-researched'}),/not yet been verified/);
});
test('retailer, food group and ingredient search compose and empty selections can be reset',()=>{
 assert.equal(ingredientsAtRetailer(foods).length,114);
 const aldi=ingredientsAtRetailer(foods,'aldi');assert.equal(aldi.length,12);
 assert.ok(aldi.every(f=>buyingOptions(f).some(r=>r.retailer_id==='aldi')));
 assert.equal(browseIngredients(aldi,{query:'broccoli',category:'vegetables'}).counts.all,1);
 assert.equal(browseIngredients(aldi,{query:'broccoli',category:'fruit'}).groups.length,0);
 assert.equal(ingredientsAtRetailer(foods,'marks-spencer').length,0);
 assert.equal(ingredientsAtRetailer(foods,'all').length,114);
});
