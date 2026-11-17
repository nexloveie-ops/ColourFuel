import {prepareMenuCatalog} from './menu-formulations.mjs';
import {NUTRIENT_RANKING_SQL} from './nutrient-ranking-query.mjs';
export async function prepareWebCatalog(live,query){
 const data=prepareMenuCatalog(live);
 const result=await query(NUTRIENT_RANKING_SQL,[JSON.stringify(data)]);
 const rankings=result.rows[0]?.rankings;
 if(rankings?.engine!=='postgresql-window-functions'||rankings.basis!=='100g_edible'||rankings.catalog_read_at!==data.read_at||rankings.with_estimates.length!==data.metrics.length||rankings.source_only.length!==data.metrics.length)throw Error('Invalid database rankings');
 return {...data,nutrient_rankings:rankings,catalog_preparation:'server'};
}
