import {prepareMenuRecipes} from './menu-formulations.mjs';
export const PERSISTENT_CATALOG_MIGRATION='006_persistent_ingredient_catalog';
export function preparePersistentCatalog(live){
 if(live.catalog_persistence?.migration_id!==PERSISTENT_CATALOG_MIGRATION||live.catalog_persistence.storage!=='cloud-sql-tables'||live.local_supplement_count!==0||live.persistent_ingredient_count!==live.ingredients?.length||!live.ingredients?.length)throw Error('Persistent ingredient catalogue unavailable');
 const ids=new Set(live.ingredients.map(f=>f.variant_id)),metrics=new Set(live.metrics?.map(m=>m.metric_id)),retailers=new Set(live.irish_retailers?.map(r=>r.id)),foods=new Set(live.ingredients.map(f=>f.ingredient_id));
 if(ids.size!==live.ingredients.length||!metrics.size||live.ingredients.some(f=>!f.database_record||f.local_supplement||!f.record_id||!Array.isArray(f.nutrients)))throw Error('Invalid persistent ingredient records');
 if(!Array.isArray(live.ingredient_photos)||live.ingredient_photos.length!==ids.size||new Set(live.ingredient_photos.map(p=>p.variant_id)).size!==ids.size||live.ingredient_photos.some(p=>!ids.has(p.variant_id)))throw Error('Persistent ingredient photos incomplete');
 if(!retailers.size||!Array.isArray(live.irish_buying_references)||live.irish_buying_references.some(r=>!foods.has(r.ingredient_id)||!retailers.has(r.retailer_id)))throw Error('Persistent Irish buying evidence incomplete');
 return prepareMenuRecipes(live);
}
