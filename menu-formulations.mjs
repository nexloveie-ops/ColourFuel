import {SUPPLIER_INGREDIENTS,SUPPLIER_DATASET} from './supplier-ingredients.mjs';
import {INGREDIENT_ADDITIONS,EXTRA_METRICS,EXTRA_VALUES} from './ingredient-additions.mjs';
import {PRODUCTS} from './product-content.mjs';
import {SAUCES} from './sauce-content.mjs';
import {calculate,fromCatalog,applyPreset} from './recipe-engine.mjs';
// Proposed edible weights for one development bowl. These are not costed or released shop portions.
export const FORMULATIONS={
 'everyday-chicken':[['chicken-breast--roasted',80],['brown-rice--cooked',120],['broccoli--raw',30],['carrot--raw',30],['red-pepper--raw',30],['olive-oil--ready_to_use',5]],
 'rainbow-chicken':[['chicken-breast--roasted',100],['quinoa--cooked',100],['broccoli--raw',40],['carrot--raw',40],['red-pepper--raw',40],['olive-oil--ready_to_use',10]],
 'plant-power-crunch':[['chickpea--boiled',120],['quinoa--cooked',100],['spinach--raw',40],['carrot--raw',40],['red-pepper--raw',50],['olive-oil--ready_to_use',10]],
 'mediterranean-garden':[['quinoa--cooked',100],['chickpea--boiled',80],['tomato--raw',50],['cucumber--raw',50],['spinach--raw',30],['feta--ready_to_eat',25],['olive-oil--ready_to_use',5]],
 'asian-sesame-crunch':[['brown-rice--cooked',120],['edamame--cooked',80],['purple-cabbage--raw',40],['carrot--raw',40],['cucumber--raw',40],['spring-onion--raw',10],['sesame-seed--toasted',5]],
 'coastal-colour':[['tuna--cooked',90],['brown-rice--cooked',120],['spinach--raw',30],['tomato--raw',40],['cucumber--raw',40],['sweetcorn--cooked',40]],
 'crispy-pork':[['pork-shavings--cooked',90],['brown-rice--cooked',120],['purple-cabbage--raw',40],['carrot--raw',40],['cucumber--raw',40],['spinach--raw',30]],
 'signature-salmon':[['atlantic-salmon--cooked',100],['brown-rice--cooked',100],['spinach--raw',40],['tomato--raw',60],['cucumber--raw',50],['olive-oil--ready_to_use',5]]
};
// Fixed, proposed kitchen-test changes. They do not infer an individual activity requirement.
const PRESET_CHANGES={
 'everyday-chicken':{'Protein+':{'chicken-breast--roasted':130},'Active Day':{'brown-rice--cooked':190}},
 'rainbow-chicken':{'Protein+':{'chicken-breast--roasted':150},'Active Day':{'quinoa--cooked':170}},
 'plant-power-crunch':{'Protein+':{'chickpea--boiled':180},'Active Day':{'quinoa--cooked':170}},
 'mediterranean-garden':{'Protein+':{'chickpea--boiled':140},'Active Day':{'quinoa--cooked':170}},
 'asian-sesame-crunch':{'Protein+':{'edamame--cooked':140},'Active Day':{'brown-rice--cooked':190}},
 'coastal-colour':{'Protein+':{'tuna--cooked':140},'Active Day':{'brown-rice--cooked':190}},
 'crispy-pork':{'Protein+':{'pork-shavings--cooked':140},'Active Day':{'brown-rice--cooked':190}},
 'signature-salmon':{'Protein+':{'atlantic-salmon--cooked':150},'Active Day':{'brown-rice--cooked':170}}
};
function completeMenuPresets(data){
 data.presets||=[];
 for(const p of PRODUCTS){const recipe=data.recipes.find(r=>r.recipe_id===p.recipe_id),original=fromCatalog(recipe);
  for(const label of ['Protein+','Active Day']){
   const existing=data.presets.find(x=>x.recipe_id===recipe.recipe_id&&x.label===label);
   if(existing){applyPreset(original,existing,data);continue;}
   const required_original=Object.fromEntries(original.items.map(i=>[i.variant_id,i.grams]));
   const preset={preset_id:p.product_id+(label==='Protein+'?'-protein':'-active'),product_id:p.product_id,recipe_id:recipe.recipe_id,label,goal_metric:label==='Protein+'?'protein':'energy_reported',required_original,weights:{...required_original,...PRESET_CHANGES[p.product_id][label]},required_sources:Object.fromEntries(original.items.map(i=>[i.variant_id,data.ingredients.find(f=>f.variant_id===i.variant_id).record_id])),review:{status:'calculation_checked',rule_version:1,scope:'Base ingredients only: source compatibility and an increase in the named metric. Proposed test weights, not a personalised recommendation.',kitchen_validation:'pending',allergen_review:'pending'},exclusions:['Suggested test portion; kitchen and allergen review pending','Sauce is retained separately; full-bowl nutrition remains pending','Not a personal daily requirement or medical prescription']};
   applyPreset(original,preset,data);data.presets.push(preset);
  }
 }
}
export function prepareMenuCatalog(live){
 const data=structuredClone(live);data.sauces=structuredClone(SAUCES);
 for(const food of [...INGREDIENT_ADDITIONS,...SUPPLIER_INGREDIENTS]){if(!data.ingredients.some(i=>i.variant_id===food.variant_id))data.ingredients.push(structuredClone(food));}
 for(const m of EXTRA_METRICS)if(!data.metrics.some(x=>x.metric_id===m.metric_id))data.metrics.push(structuredClone(m));
 for(const food of data.ingredients)for(const n of EXTRA_VALUES[food.record_id]||[]){if(!food.nutrients.some(x=>x.metric_id===n.metric_id))food.nutrients.push(structuredClone(n));}
 data.local_supplement_count=INGREDIENT_ADDITIONS.length+SUPPLIER_INGREDIENTS.length;data.datasets.push(structuredClone(SUPPLIER_DATASET));
 for(const p of PRODUCTS){
  const weights=FORMULATIONS[p.product_id];
  const recipe={recipe_id:p.recipe_id,title_en:p.name,bowl_product_id:p.product_id,version:1,servings:1,minutes:null,category:'Sample bowls',origin:'ColourFuel suggested test formulation v1',status:'proposed_test_formulation',description:p.description,image:p.image,colors:[],steps:['Use the food state listed for each ingredient. The quantities are edible weights for one suggested test bowl.','Select one required sauce and its test weight. Final kitchen method, yield, nutrition and allergen review are pending.'],nutrition_method:'Ingredient estimates; unverified ingredients and sauces stay incomplete',items:weights.map(([id,grams],index)=>{const i=data.ingredients.find(i=>i.variant_id===id);if(!i)throw Error('Missing ingredient '+id);return {line_no:index+1,variant_id:id,edible_grams:grams,name:i.name_en,state:i.state,edible_description:i.edible_description,record_id:i.record_id,dataset_id:i.dataset_id,source_name:i.source_name,source_food_id:i.source_food_id,source_url:i.source_url};})};
  const existing=data.recipes.findIndex(r=>r.recipe_id===p.recipe_id);if(existing>=0)data.recipes[existing]=recipe;else data.recipes.push(recipe);
  if(!data.products.some(x=>x.recipe_id===p.recipe_id))data.products.push({...p});
 }
 for(const recipe of data.recipes.filter(r=>r.bowl_product_id)){
  const result=calculate(fromCatalog(recipe),data);
  recipe.nutrition=Object.values(result.metrics).map(n=>({metric_id:n.id,complete:n.status==='complete',per_serving:n.perServing,reference_fill_items:n.references}));
 }
 completeMenuPresets(data);
 return data;
}
