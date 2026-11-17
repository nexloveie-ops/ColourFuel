// Comparisons use this catalogue only, the exact nutrient definition/unit and a 100 g edible basis.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const nutrientAmount=value=>Number(value).toLocaleString('en-IE',{maximumSignificantDigits:4});
export function buildNutrientIndex(foods,metrics,{includeEstimates=true}={}){
 return new Map(metrics.map(metric=>{
  const coverage={total:foods.length,known:0,positive:0,zero:0,trace:0,missing:0,incompatible:0,estimatesExcluded:0,estimates:0};
  const rows=[];
  for(const food of foods){
   if(food.source_basis&&food.source_basis!=='100g_food'){coverage.incompatible++;continue;}
   const branded=Boolean(food.reported_nutrients);
   const nutrient=(food.reported_nutrients||food.nutrients||[]).find(n=>n.metric_id===metric.metric_id);
   if(nutrient?.result==='trace_retained'){coverage.trace++;continue;}
   if(nutrient&&nutrient.unit!==metric.unit){coverage.incompatible++;continue;}
   const estimated=nutrient?.result==='reference_imputation';
   const value=branded?nutrient?.value:estimated?nutrient.filled_value:nutrient?.result==='primary_numeric'?nutrient.primary_value:null;
   if(typeof value!=='number'||!Number.isFinite(value)||value<0){coverage.missing++;continue;}
   if(estimated&&!includeEstimates){coverage.estimatesExcluded++;continue;}
   coverage.known++;if(value>0)coverage.positive++;else coverage.zero++;if(estimated)coverage.estimates++;
   rows.push({food,value,unit:metric.unit,estimated,kind:estimated?'Reference estimate':branded?'Manufacturer reference':'Source value'});
  }
  rows.sort((a,b)=>b.value-a.value||a.food.name_en.localeCompare(b.food.name_en,'en-IE')||a.food.variant_id.localeCompare(b.food.variant_id));
  for(let i=0;i<rows.length;){let end=i+1;while(end<rows.length&&rows[end].value===rows[i].value)end++;
   for(let j=i;j<end;j++)Object.assign(rows[j],{rank:i+1,tied:end-i,total:rows.length,topPercent:Math.ceil(end/rows.length*100)});
   i=end;
  }
  return [metric.metric_id,{metric,rows,coverage,includeEstimates}];
 }));
}
export function nutrientRank(index,variantId,metricId){return index.get(metricId)?.rows.find(row=>row.food.variant_id===variantId)||null;}
export function rankLabel(row){return row.total>=10&&row.value>0&&row.topPercent<=25?`Top ${row.topPercent}% in this library`:`Rank ${row.rank} of ${row.total} in this library`;}
export function nutrientRankNote(food,metricId,index){
 const row=nutrientRank(index,food.variant_id,metricId);if(!row||row.value<=0)return '';
 return `<div class="nutrient-library-position"><strong>${esc(rankLabel(row))}</strong><small>${row.tied>1?'Tied rank':'Rank'} ${row.rank} of ${row.total} comparable entries · per 100 g${row.tied>1?` · ${row.tied} entries tied`:''}${row.estimated?' · includes a reference estimate':''}</small><button class="inline-link" data-action="explore-nutrient" data-metric="${esc(metricId)}">Compare all ${esc(index.get(metricId).metric.name_en)} ingredients ↗</button></div>`;
}
const highlightIds=['protein','fibre_total_dietary','vitamin_c','calcium','iron','magnesium','potassium','zinc','copper','manganese','selenium','iodine','chloride','biotin','thiamin','riboflavin','niacin','pantothenic_acid','vitamin_b6','vitamin_b12','vitamin_k1','folate_total','phosphorus'];
export function foodRankingHighlights(food,index){
 return highlightIds.map(id=>({id,row:nutrientRank(index,food.variant_id,id),metric:index.get(id)?.metric})).filter(item=>item.row?.value>0&&item.row.total>=10).sort((a,b)=>a.row.topPercent-b.row.topPercent||highlightIds.indexOf(a.id)-highlightIds.indexOf(b.id)).slice(0,3);
}
export function foodRankSummary(food,index){const item=foodRankingHighlights(food,index)[0];if(!item||item.row.topPercent>25)return '';return `<small class="ingredient-rank-summary">${esc(item.metric.name_en)} · ${esc(rankLabel(item.row))}<span>${nutrientAmount(item.row.value)} ${esc(item.metric.unit)} / 100 g · ${item.row.tied>1?'tied ':''}#${item.row.rank} of ${item.row.total}</span></small>`;}
export function foodRankingPanel(food,index){
 const highlights=foodRankingHighlights(food,index);
 if(food.source_basis&&food.source_basis!=='100g_food')return '<p class="ranking-basis-note">Library ranking unavailable: this source uses a different basis (for example, per 100 ml). A verified density conversion is needed before comparing it with per-100-g records.</p>';
 return `<section class="food-ranking-panel"><div class="eyebrow">A PLACE IN THE LIBRARY</div><h3>What stands out?</h3><p>Compared with this library’s entries that have numerical values for the same nutrient, per 100 g edible food. ${index.values().next().value?.includeEstimates?'Labelled reference estimates are included.':'Reference estimates are excluded.'}</p>${highlights.length?`<div class="food-ranking-highlights">${highlights.map(({id,row,metric})=>`<article><h4>${esc(metric.name_en)}</h4><p>${nutrientAmount(row.value)} ${esc(metric.unit)} per 100 g · ${esc(row.kind)}</p>${nutrientRankNote(food,id,index)}</article>`).join('')}</div>`:'<p>There are not enough comparable numerical records to highlight a nutrient here.</p>'}<details class="ranking-method"><summary>How these rankings work</summary><p>This is a comparison within the current ColourFuel library, not all foods worldwide. Raw, cooked and dried states are separate entries. Water content and preparation affect concentration; per 100 g is not a serving recommendation.</p><p>Rank = one plus the number of entries with a strictly larger value. Equal values share a rank. “Top X%” includes the entire tied group, rounded up to the next whole percentage. Zero values stay in the comparison pool; unknown, trace, incompatible units/bases and excluded estimates do not. A percentile badge needs at least 10 numerical entries.</p><p>Highlights show the three strongest relative positions among tracked vitamins, minerals, protein and fibre. They are a way to explore food composition, not a health score or a regulated nutrition claim. Higher amounts are not always better.</p></details></section>`;
}
