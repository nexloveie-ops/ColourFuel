import {PRODUCTS} from './product-content.mjs';
import {SAUCES} from './sauce-content.mjs';
import {calculate,fromCatalog,applyPreset} from './recipe-engine.mjs';
// Proposed edible weights for one development bowl. These are not costed or released shop portions.
export const FORMULATIONS={
 'everyday-chicken':[['chicken-breast--roasted',100],['brown-rice--cooked',150],['broccoli--raw',50],['carrot--raw',50],['red-pepper--raw',50],['olive-oil--ready_to_use',5]],
 'rainbow-chicken':[['chicken-breast--roasted',100],['quinoa--cooked',100],['broccoli--raw',50],['carrot--raw',50],['red-pepper--raw',50],['olive-oil--ready_to_use',10]],
 'plant-power-crunch':[['chickpea--boiled',150],['quinoa--cooked',100],['spinach--raw',25],['carrot--raw',50],['red-pepper--raw',50],['olive-oil--ready_to_use',10]],
 'mediterranean-garden':[['quinoa--cooked',100],['chickpea--boiled',100],['tomato--raw',50],['cucumber--raw',50],['spinach--raw',25],['feta--ready_to_eat',25],['olive-oil--ready_to_use',5]],
 'asian-sesame-crunch':[['brown-rice--cooked',150],['edamame--cooked',100],['purple-cabbage--raw',50],['carrot--raw',50],['cucumber--raw',50],['spring-onion--raw',10],['sesame-seed--toasted',5]],
 'coastal-colour':[['tuna--cooked',100],['brown-rice--cooked',150],['spinach--raw',25],['tomato--raw',50],['cucumber--raw',50],['sweetcorn--cooked',50]],
 'crispy-pork':[['pork-shavings--cooked',100],['brown-rice--cooked',150],['purple-cabbage--raw',50],['carrot--raw',50],['cucumber--raw',50],['spinach--raw',25]],
 'signature-salmon':[['atlantic-salmon--cooked',100],['brown-rice--cooked',100],['spinach--raw',25],['tomato--raw',50],['cucumber--raw',50],['olive-oil--ready_to_use',5]]
};
// Fixed, proposed kitchen-test changes. They do not infer an individual activity requirement.
const PRESET_CHANGES={
 'everyday-chicken':{'Protein+':{'chicken-breast--roasted':150},'Active Day':{'brown-rice--cooked':200}},
 'rainbow-chicken':{'Protein+':{'chicken-breast--roasted':150},'Active Day':{'quinoa--cooked':150}},
 'plant-power-crunch':{'Protein+':{'chickpea--boiled':200},'Active Day':{'quinoa--cooked':150}},
 'mediterranean-garden':{'Protein+':{'chickpea--boiled':150},'Active Day':{'quinoa--cooked':150}},
 'asian-sesame-crunch':{'Protein+':{'edamame--cooked':150},'Active Day':{'brown-rice--cooked':200}},
 'coastal-colour':{'Protein+':{'tuna--cooked':150},'Active Day':{'brown-rice--cooked':200}},
 'crispy-pork':{'Protein+':{'pork-shavings--cooked':150},'Active Day':{'brown-rice--cooked':200}},
 'signature-salmon':{'Protein+':{'atlantic-salmon--cooked':150},'Active Day':{'brown-rice--cooked':150}}
};
function completeMenuPresets(data){
 data.presets=(data.presets||[]).filter(p=>!PRODUCTS.some(b=>b.recipe_id===p.recipe_id));
 for(const p of PRODUCTS){const recipe=data.recipes.find(r=>r.recipe_id===p.recipe_id),original=fromCatalog(recipe);
  for(const label of ['Protein+','Active Day']){
   const existing=data.presets.find(x=>x.recipe_id===recipe.recipe_id&&x.label===label);
   if(existing){applyPreset(original,existing,data);continue;}
   const required_original=Object.fromEntries(original.items.map(i=>[i.variant_id,i.grams]));
   const preset={preset_id:p.product_id+(label==='Protein+'?'-protein':'-active'),product_id:p.product_id,recipe_id:recipe.recipe_id,label,goal_metric:label==='Protein+'?'protein':'energy_reported',required_original,weights:{...required_original,...PRESET_CHANGES[p.product_id][label]},required_sources:Object.fromEntries(original.items.map(i=>[i.variant_id,data.ingredients.find(f=>f.variant_id===i.variant_id).record_id])),review:{status:'calculation_checked',rule_version:2,scope:'Base ingredients only: source compatibility and an increase in the named metric. Proposed test weights, not a personalised recommendation.',kitchen_validation:'pending',allergen_review:'pending'},exclusions:['Suggested test portion; kitchen and allergen review pending','Sauce is retained separately; full-bowl nutrition remains pending','Not a personal daily requirement or medical prescription']};
   applyPreset(original,preset,data);data.presets.push(preset);
  }
 }
}
// Recipes remain concept formulations; ingredients and nutrient values are supplied by the database.
export function prepareMenuRecipes(live){
 const data=structuredClone(live);data.sauces=structuredClone(SAUCES);
 for(const p of PRODUCTS){
  const weights=FORMULATIONS[p.product_id];
  const recipe={recipe_id:p.recipe_id,title_en:p.name,bowl_product_id:p.product_id,version:2,servings:1,minutes:null,category:'Sample bowls',origin:'ColourFuel standard-portion test formulation v2',status:'proposed_test_formulation',description:p.description,image:p.image,colors:[],steps:['Use the food state listed for each ingredient. The quantities are edible weights for one suggested test bowl.','Select one required sauce and its test weight. Final kitchen method, yield, nutrition and allergen review are pending.'],nutrition_method:'Ingredient estimates; unverified ingredients and sauces stay incomplete',items:weights.map(([id,grams],index)=>{const i=data.ingredients.find(i=>i.variant_id===id);if(!i)throw Error('Missing ingredient '+id);return {line_no:index+1,variant_id:id,edible_grams:grams,name:i.name_en,state:i.state,edible_description:i.edible_description,record_id:i.record_id,dataset_id:i.dataset_id,source_name:i.source_name,source_food_id:i.source_food_id,source_url:i.source_url};})};
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
