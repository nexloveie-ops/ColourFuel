// Builds the Swift parity fixtures from the website's own engine, so the iOS app is checked against the same numbers.
// Usage: node ios/tools/make-parity-fixtures.mjs <catalog.json from /api/catalog>
import {readFile,writeFile} from 'node:fs/promises';
import {fromCatalog,calculate} from '../../recipe-engine.mjs';
import {portionPricing,demoFoodStandard,demoSauceStandard,portionStandard} from '../../portion-standards.mjs';
const catalog=JSON.parse(await readFile(process.argv[2],'utf8'));
const out=new URL('../ColourFuelKit/Tests/ColourFuelKitTests/Fixtures/',import.meta.url);
const metrics=['energy_reported','protein','fat','carbohydrate_by_difference','fibre_total_dietary','sugars_total','saturated_fat','salt','vitamin_c','iron','calcium','iodine'];
const pick=r=>Object.fromEntries(metrics.map(id=>[id,r.metrics[id]?{status:r.metrics[id].status,perServing:r.metrics[id].perServing}:null]));
const cases=[];
for(const p of catalog.products.filter(p=>p.illustrative_price_cents)){
 const recipe=catalog.recipes.find(r=>r.recipe_id===p.recipe_id);if(!recipe?.bowl_product_id)continue;
 const original=fromCatalog(recipe),sauce=catalog.sauces.find(s=>s.pairs.includes(p.product_id))||catalog.sauces[0];
 const first=original.items[0],food=catalog.ingredients.find(i=>i.variant_id===first.variant_id),std=portionStandard(food);
 const variants=[
  {label:'original',current:{...original,sauce:{id:sauce.id,grams:sauce.default_grams}}},
  {label:'extra-first-plus-avocado-double-sauce',current:{...original,items:[...original.items.map((i,n)=>n===0?{...i,grams:i.grams+std.grams}:i),{variant_id:'avocado--raw',grams:50}],sauce:{id:sauce.id,grams:sauce.default_grams*2}}},
  {label:'removed-last',current:{...original,items:original.items.slice(0,-1),sauce:{id:sauce.id,grams:sauce.default_grams}}}
 ];
 for(const v of variants){
  const nutrition=calculate(v.current,catalog,{includeSauce:false});
  const price=portionPricing(original,v.current,catalog.ingredients,catalog.sauces,p.illustrative_price_cents,{foodStandard:demoFoodStandard,saucePortion:demoSauceStandard,allowDemo:true});
  cases.push({product_id:p.product_id,label:v.label,items:v.current.items,sauce:v.current.sauce,weight:nutrition.weight,metrics:pick(nutrition),demo_price_cents:price.targetPriceCents});
 }
}
// Trimmed catalogue: every food the cases use, plus sauces, metrics, menu recipes and products.
const used=new Set(cases.flatMap(c=>c.items.map(i=>i.variant_id)));
const trimmed={...catalog,ingredients:catalog.ingredients.filter(i=>used.has(i.variant_id)),ingredient_photos:catalog.ingredient_photos.filter(p=>used.has(p.variant_id)),irish_buying_references:[],nutrient_rankings:undefined,recipes:catalog.recipes.filter(r=>r.bowl_product_id)};
await writeFile(new URL('catalog-fixture.json',out),JSON.stringify(trimmed));
await writeFile(new URL('parity.json',out),JSON.stringify({generated_from:'recipe-engine.mjs + portion-standards.mjs',read_at:catalog.read_at,cases},null,1));
console.log(cases.length,'cases');
