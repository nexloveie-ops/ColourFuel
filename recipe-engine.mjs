export const ENGINE_VERSION = '1.0.0-mvp';
const clone = value => structuredClone(value);
export function validateRecipe(recipe, catalog) {
  if (!recipe || typeof recipe.title !== 'string' || !recipe.title.trim() || recipe.title.length > 100) throw Error('Use a recipe name of 1–100 characters.');
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 12) throw Error('Choose 1–12 servings.');
  if (!Array.isArray(recipe.items) || !recipe.items.length || recipe.items.length > 40) throw Error('Use 1–40 ingredients.');
  const seen = new Set();
  for (const item of recipe.items) {
    if (!catalog.ingredients.some(i => i.variant_id === item.variant_id) || seen.has(item.variant_id)) throw Error('An ingredient is unavailable or repeated.');
    seen.add(item.variant_id);
    if (!Number.isFinite(item.grams) || item.grams < 0 || item.grams > 2000 || Math.abs(item.grams * 10 - Math.round(item.grams * 10)) > 1e-7) throw Error('Use edible weights from 0–2,000 g, in 0.1 g increments.');
  }
  if (!recipe.items.some(i => i.grams > 0)) throw Error('Add at least one ingredient above 0 g.');
  return recipe;
}
export function fromCatalog(recipe) {
  return { title: recipe.title_en, servings: Number(recipe.servings), items: recipe.items.map(i => ({variant_id:i.variant_id,grams:Number(i.edible_grams)})), source_recipe_id:recipe.recipe_id, mode:'Original Recipe', preset_id:null };
}
export function makeOriginal(recipe, catalog) {
  validateRecipe(recipe, catalog);
  return {...clone(recipe),mode:'Original Recipe',preset_id:null};
}
export function editRecipe(recipe, patch, catalog) {
  const next={...clone(recipe),...clone(patch),mode:'Custom Recipe',preset_id:null};
  validateRecipe(next,catalog);
  return next;
}
export function calculate(recipe, catalog) {
  validateRecipe(recipe,catalog);
  const ingredients=new Map(catalog.ingredients.map(i=>[i.variant_id,i]));
  const active=recipe.items.filter(i=>i.grams>0).sort((a,b)=>a.variant_id.localeCompare(b.variant_id));
  const metrics={};
  for (const metric of catalog.metrics) {
    let numerator=0n,missing=0,trace=0,references=0;
    const provenance=[];
    for(const item of active){
      const ingredient=ingredients.get(item.variant_id), n=ingredient.nutrients.find(n=>n.metric_id===metric.metric_id);
      const isTrace=n?.result==='trace_retained';
      const isReference=n?.result==='reference_imputation';
      const value=isReference?n.filled_value:n?.primary_value;
      const valid=n?.unit===metric.unit && ['primary_numeric','reference_imputation'].includes(n?.result) && typeof value==='number' && Number.isFinite(value) && value>=0;
      if(isTrace)trace++; else if(!valid)missing++;
      if(valid){
        // Six decimal places in source units and tenths of a gram; integer summation.
        numerator+=BigInt(Math.round(value*1e6))*BigInt(Math.round(item.grams*10));
        if(isReference)references++;
      }
      provenance.push({variant_id:item.variant_id,grams:item.grams,state:ingredient.state,primary_record_id:ingredient.record_id,effective_record_id:isReference?n.donor_record_id:ingredient.record_id,kind:isTrace?'trace':valid?n.result:'not_resolved',value_per_100g:valid?value:null,unit:metric.unit,reference_note:isReference?ingredient.reference_fills.find(f=>f.metric_id===metric.metric_id)?.food_match_note:null});
    }
    const knownTotal=Number(numerator)/1e9,complete=missing===0&&trace===0;
    metrics[metric.metric_id]={id:metric.metric_id,name:metric.name_en,unit:metric.unit,status:complete?'complete':missing?'incomplete':'trace',total:complete?knownTotal:null,perServing:complete?knownTotal/recipe.servings:null,knownTotal,missing,trace,references,provenance};
  }
  const sodium=metrics.sodium;
  if(sodium){
    const complete=sodium.status==='complete'&&sodium.unit==='mg';
    metrics.salt={...clone(sodium),id:'salt',name:'Salt equivalent',unit:'g',status:complete?'complete':sodium.status==='trace'?'trace':'incomplete',total:complete?sodium.total*2.5/1000:null,perServing:complete?sodium.perServing*2.5/1000:null,knownTotal:sodium.knownTotal*2.5/1000,derivation:'Sodium (mg) × 2.5 ÷ 1,000 = salt equivalent (g)',provenance:sodium.provenance};
  }
  return {metrics,weight:active.reduce((n,i)=>n+i.grams,0),servings:recipe.servings};
}
export function compare(original,current,catalog){
  const before=calculate(original,catalog),after=calculate(current,catalog);
  const ids=new Set([...original.items,...current.items].map(i=>i.variant_id));
  const ingredients=[...ids].map(id=>({variant_id:id,before:original.items.find(i=>i.variant_id===id)?.grams||0,after:current.items.find(i=>i.variant_id===id)?.grams||0})).map(i=>({...i,delta:i.after-i.before}));
  const metrics=Object.keys(after.metrics).map(id=>({id,before:before.metrics[id],after:after.metrics[id],delta:before.metrics[id]?.status==='complete'&&after.metrics[id].status==='complete'?after.metrics[id].perServing-before.metrics[id].perServing:null}));
  return {before,after,ingredients,metrics};
}
export function applyPreset(original,preset,catalog){
  validateRecipe(original,catalog);
  if(!preset || preset.review?.status!=='calculation_checked' || preset.recipe_id!==original.source_recipe_id)throw Error('This test preset is not available for this original recipe.');
  const weights=Object.fromEntries(original.items.filter(i=>i.grams>0).map(i=>[i.variant_id,i.grams]));
  if(original.servings!==1 || Object.keys(weights).length!==Object.keys(preset.required_original).length || Object.entries(preset.required_original).some(([id,g])=>weights[id]!==g)) throw Error('This preset only matches the sample original recipe and serving count.');
  if(Object.entries(preset.required_sources).some(([id,record])=>catalog.ingredients.find(i=>i.variant_id===id)?.record_id!==record))throw Error('The ingredient source has changed; this preset needs a new review.');
  const next={...clone(original),items:[...original.items.filter(i=>Object.hasOwn(preset.weights,i.variant_id)).map(i=>({variant_id:i.variant_id,grams:preset.weights[i.variant_id]})),...Object.entries(preset.weights).filter(([id])=>!original.items.some(i=>i.variant_id===id)).map(([variant_id,grams])=>({variant_id,grams}))],mode:'Goal Preset',preset_id:preset.preset_id};
  const base=calculate(original,catalog).metrics[preset.goal_metric], adjusted=calculate(next,catalog).metrics[preset.goal_metric];
  if(!base||!adjusted||base.status!=='complete'||adjusted.status!=='complete'||adjusted.perServing<=base.perServing)throw Error('The source data no longer supports this preset.');
  return next;
}
export function passport(original,current,catalog){
  const result=compare(original,current,catalog);
  return {format:'ColourFuel Nutrition Passport',version:1,engine_version:ENGINE_VERSION,created_at:new Date().toISOString(),data_read_at:catalog.read_at,stage:'Development estimate — not a shop label',original:clone(original),current:clone(current),nutrition:result.after,comparison:result.metrics,ingredient_changes:result.ingredients,datasets:clone(catalog.datasets),preset:current.preset_id?clone(catalog.presets?.find(p=>p.preset_id===current.preset_id)):null,limitations:['Original Recipe is a comparison reference, not a health ranking.','No individual medical needs are inferred.','Cooked and raw weights use their own source records; extra cooking loss, retention and assembly yield are not modelled.','Allergen, cross-contact and kitchen feasibility reviews are pending.','Incomplete and trace nutrients are not counted as zero.']};
}
export function encodeShare(original,current,catalog){
  validateRecipe(original,catalog);validateRecipe(current,catalog);
  const text=JSON.stringify({v:1,original,current});
  const bytes=new TextEncoder().encode(text);
  return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeShare(code,catalog){
  if(typeof code!=='string'||code.length>20000||!/^[A-Za-z0-9_-]+$/.test(code))throw Error('This shared recipe link is invalid.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
  const value=JSON.parse(text);
  if(value.v!==1)throw Error('This recipe link uses an unsupported version.');
  const pick=r=>({title:r.title,servings:r.servings,items:r.items?.map(i=>({variant_id:i.variant_id,grams:i.grams})),source_recipe_id:typeof r.source_recipe_id==='string'?r.source_recipe_id:null,mode:'Custom Recipe',preset_id:null});
  const original=makeOriginal(pick(value.original),catalog),current=pick(value.current);
  validateRecipe(current,catalog);
  return {original,current};
}
