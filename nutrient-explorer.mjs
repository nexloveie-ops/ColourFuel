// Comparisons use this catalogue only, the exact nutrient definition/unit and a 100 g edible basis.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const nutrientAmount=value=>Number(value).toLocaleString('en-IE',{maximumSignificantDigits:4});
// Hydrate database results for rendering only: no browser sorting, ranking or percentile calculation.
export function hydrateNutrientIndex(catalog,{includeEstimates=true}={}){
 const response=catalog.nutrient_rankings;
 if(response?.engine!=='postgresql-window-functions'||response.basis!=='100g_edible'||response.catalog_read_at!==catalog.read_at)throw Error('Database nutrient rankings unavailable');
 const foods=new Map(catalog.ingredients.map(food=>[food.variant_id,food]));
 const entries=new Map((includeEstimates?response.with_estimates:response.source_only).map(entry=>[entry.metric_id,entry]));
 return new Map(catalog.metrics.map(metric=>{
  const entry=entries.get(metric.metric_id);if(!entry||entry.coverage.total!==foods.size)throw Error('Incomplete database ranking coverage');
  const rows=entry.rows.map(row=>{
   const food=foods.get(row.variant_id);
   if(!food||row.unit!==metric.unit||typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<0||!Number.isInteger(row.rank)||row.rank<1||row.total!==entry.coverage.known||!Number.isInteger(row.topPercent)||row.topPercent<1||row.topPercent>100)throw Error('Invalid database ranking row');
   return {...row,food};
  });
  if(rows.length!==entry.coverage.known)throw Error('Incomplete database ranking rows');
  return [metric.metric_id,{metric,rows,coverage:entry.coverage,includeEstimates}];
 }));
}
export function nutrientRank(index,variantId,metricId){return index.get(metricId)?.rows.find(row=>row.food.variant_id===variantId)||null;}
export function rankLabel(row){return row.total>=10&&row.value>0&&row.topPercent<=25?`Top ${row.topPercent}% in this library`:`Rank ${row.rank} of ${row.total} in this library`;}
export function nutrientRankNote(food,metricId,index){
 const row=nutrientRank(index,food.variant_id,metricId);if(!row||row.value<=0)return '';
 return `<div class="nutrient-library-position"><strong>${esc(rankLabel(row))}</strong><small>${row.tied>1?'Tied rank':'Rank'} ${row.rank} of ${row.total} comparable entries · per 100 g${row.tied>1?` · ${row.tied} entries tied`:''}${row.estimated?' · includes a reference estimate':''}</small><button class="inline-link" data-action="explore-nutrient" data-metric="${esc(metricId)}">Compare all ${esc(index.get(metricId).metric.name_en)} ingredients</button></div>`;
}
const highlightIds=['protein','fibre_total_dietary','vitamin_c','calcium','iron','magnesium','potassium','zinc','copper','manganese','selenium','iodine','chloride','biotin','thiamin','riboflavin','niacin','pantothenic_acid','vitamin_b6','vitamin_b12','vitamin_k1','folate_total','phosphorus'];
export function foodRankingHighlights(food,index){
 return highlightIds.map(id=>({id,row:nutrientRank(index,food.variant_id,id),metric:index.get(id)?.metric})).filter(item=>item.row?.value>0&&item.row.total>=10).sort((a,b)=>a.row.topPercent-b.row.topPercent||highlightIds.indexOf(a.id)-highlightIds.indexOf(b.id)).slice(0,3);
}
// Card summary: a familiar nutrient with a broad comparison pool (at least half the library's records); the detail panel keeps every highlight.
const SUMMARY_EXCLUDED=new Set(['chloride','biotin','pantothenic_acid','iodine']);
export function foodRankSummary(food,index){const size=Math.max(0,...[...index.values()].map(entry=>entry.coverage?.total||0));const item=foodRankingHighlights(food,index).find(item=>!SUMMARY_EXCLUDED.has(item.id)&&(!size||item.row.total>=size/2));if(!item||item.row.topPercent>25)return '';return `<small class="ingredient-rank-summary">${esc(item.metric.name_en)} · ${esc(rankLabel(item.row))}<span>${nutrientAmount(item.row.value)} ${esc(item.metric.unit)} / 100 g · ${item.row.tied>1?'tied ':''}#${item.row.rank} of ${item.row.total}</span></small>`;}
export function foodRankingPanel(food,index){
 const highlights=foodRankingHighlights(food,index);
 if(food.source_basis&&food.source_basis!=='100g_food')return '<p class="ranking-basis-note">Library ranking unavailable: this source uses a different basis (for example, per 100 ml). A verified density conversion is needed before comparing it with per-100-g records.</p>';
 return `<section class="food-ranking-panel"><div class="eyebrow">A PLACE IN THE LIBRARY</div><h3>What stands out?</h3><p>Compared with this library’s entries that have numerical values for the same nutrient, per 100 g edible food. ${index.values().next().value?.includeEstimates?'Labelled reference estimates are included.':'Reference estimates are excluded.'}</p>${highlights.length?`<div class="food-ranking-highlights">${highlights.map(({id,row,metric})=>`<article><h4>${esc(metric.name_en)}</h4><p>${nutrientAmount(row.value)} ${esc(metric.unit)} per 100 g · ${esc(row.kind)}</p>${nutrientRankNote(food,id,index)}</article>`).join('')}</div>`:'<p>There are not enough comparable numerical records to highlight a nutrient here.</p>'}<details class="ranking-method"><summary>How these rankings work</summary><p>This is a comparison within the current ColourFuel library, not all foods worldwide. Raw, cooked and dried states are separate entries. Water content and preparation affect concentration; per 100 g is not a serving recommendation.</p><p>Rank = one plus the number of entries with a strictly larger value. Equal values share a rank. “Top X%” includes the entire tied group, rounded up to the next whole percentage. Zero values stay in the comparison pool; unknown, trace, incompatible units/bases and excluded estimates do not. A percentile badge needs at least 10 numerical entries.</p><p>Highlights show the three strongest relative positions among tracked vitamins, minerals, protein and fibre. They are a way to explore food composition, not a health score or a regulated nutrition claim. Higher amounts are not always better.</p></details></section>`;
}
