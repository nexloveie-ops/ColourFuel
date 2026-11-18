// Historical pre-migration data assembly for offline regression fixtures only. Never imported by the server.
import {IRISH_INGREDIENT_ADDITIONS} from '../irish-ingredient-expansion.mjs';
import {SUPPLIER_INGREDIENTS,SUPPLIER_DATASET} from '../supplier-ingredients.mjs';
import {INGREDIENT_ADDITIONS,EXTRA_METRICS,EXTRA_VALUES} from '../ingredient-additions.mjs';
import {SAUCES} from '../sauce-content.mjs';
import {prepareMenuRecipes} from '../menu-formulations.mjs';
export function prepareMenuCatalog(live){
 const data=structuredClone(live);data.sauces=structuredClone(SAUCES);
 for(const food of [...INGREDIENT_ADDITIONS,...SUPPLIER_INGREDIENTS,...IRISH_INGREDIENT_ADDITIONS]){if(!data.ingredients.some(i=>i.variant_id===food.variant_id))data.ingredients.push(structuredClone(food));}
 for(const m of EXTRA_METRICS)if(!data.metrics.some(x=>x.metric_id===m.metric_id))data.metrics.push(structuredClone(m));
 for(const food of data.ingredients)for(const n of EXTRA_VALUES[food.record_id]||[]){if(!food.nutrients.some(x=>x.metric_id===n.metric_id))food.nutrients.push(structuredClone(n));}
 data.local_supplement_count=INGREDIENT_ADDITIONS.length+SUPPLIER_INGREDIENTS.length+IRISH_INGREDIENT_ADDITIONS.length;if(!data.datasets.some(d=>d.dataset_id===SUPPLIER_DATASET.dataset_id))data.datasets.push(structuredClone(SUPPLIER_DATASET));
 return prepareMenuRecipes(data);
}
