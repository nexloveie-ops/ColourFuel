import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOriginal,editRecipe,calculate,compare,applyPreset,encodeShare,decodeShare,validateRecipe,passport} from './recipe-engine.mjs';
const metric=(metric_id,unit)=>({metric_id,unit,name_en:metric_id});
const nutrient=(metric_id,unit,primary_value,result='primary_numeric')=>({metric_id,unit,primary_value,result});
const catalog={read_at:'2026-11-15T00:00:00Z',datasets:[{publisher:'Test fixture'}],metrics:[metric('protein','g'),metric('energy_reported','kcal'),metric('sodium','mg'),metric('iron','mg')],ingredients:[
 {variant_id:'a--cooked',state:'cooked',record_id:'source:a',reference_fills:[],nutrients:[nutrient('protein','g',20),nutrient('energy_reported','kcal',150),nutrient('sodium','mg',40),nutrient('iron','mg',null,'trace_retained')]},
 {variant_id:'b--raw',state:'raw',record_id:'source:b',reference_fills:[{metric_id:'protein',food_match_note:'fixture donor'}],nutrients:[{...nutrient('protein','g',null,'reference_imputation'),filled_value:4,donor_record_id:'source:donor'},nutrient('energy_reported','kcal',60),nutrient('sodium','mg',10),nutrient('iron','mg',null,'not_resolved')]}
]};
const recipe=()=>({title:'My bowl',servings:2,source_recipe_id:'sample',items:[{variant_id:'a--cooked',grams:125.5},{variant_id:'b--raw',grams:50}]});
const preset={preset_id:'sample-protein',recipe_id:'sample',review:{status:'calculation_checked'},required_original:{'a--cooked':125.5,'b--raw':50},required_sources:{'a--cooked':'source:a','b--raw':'source:b'},weights:{'a--cooked':175.5,'b--raw':50},goal_metric:'protein'};
test('edible weights, reference nutrients, portions and salt are calculated with provenance',()=>{
 const r=calculate(recipe(),catalog);assert.equal(r.metrics.protein.total,27.1);assert.equal(r.metrics.protein.perServing,13.55);assert.equal(r.metrics.protein.references,1);assert.equal(r.metrics.protein.provenance[1].effective_record_id,'source:donor');assert.equal(r.metrics.protein.provenance[0].state,'cooked');assert.equal(r.metrics.sodium.total,55.2);assert.ok(Math.abs(r.metrics.salt.total-.138)<1e-12);assert.equal(r.weight,175.5);
});
test('trace, missing and wrong units never become a complete numeric zero',()=>{
 const r=calculate(recipe(),catalog);assert.equal(r.metrics.iron.total,null);assert.equal(r.metrics.iron.trace,1);assert.equal(r.metrics.iron.missing,1);
 const c=structuredClone(catalog);c.ingredients[0].nutrients[0].unit='mg';assert.equal(calculate(recipe(),c).metrics.protein.perServing,null);
 const a=recipe();a.items=[a.items[0]];assert.equal(calculate(a,catalog).metrics.iron.status,'trace');
 c.ingredients[0].nutrients[2].primary_value=null;assert.equal(calculate(recipe(),c).metrics.salt.total,null);
});
test('manual editing clears presets without mutating the original, even on equal weights',()=>{
 const original=makeOriginal({...recipe(),servings:1},catalog),fixed=applyPreset(original,preset,catalog);
 assert.equal(fixed.mode,'Goal Preset');assert.equal(fixed.items[0].grams,175.5);assert.equal(original.items[0].grams,125.5);
 const custom=editRecipe(fixed,{items:fixed.items},catalog);assert.equal(custom.mode,'Custom Recipe');assert.equal(custom.preset_id,null);
 const own=makeOriginal(custom,catalog);assert.ok(compare(own,own,catalog).metrics.every(m=>m.delta===0||m.delta===null));
});
test('preset refuses changed baseline, portions, sources, unreviewed or ineffective rules',()=>{
 assert.throws(()=>applyPreset(recipe(),preset,catalog));
 const original=makeOriginal({...recipe(),servings:1},catalog);
 assert.throws(()=>applyPreset(editRecipe(original,{items:[{variant_id:'a--cooked',grams:120},{variant_id:'b--raw',grams:50}]},catalog),preset,catalog));
 const c=structuredClone(catalog);c.ingredients[0].record_id='source:changed';assert.throws(()=>applyPreset(original,preset,c));
 assert.throws(()=>applyPreset(original,{...preset,review:{status:'pending'}},catalog));
 assert.throws(()=>applyPreset(original,{...preset,weights:preset.required_original},catalog));
});
test('portion changes compare per serving while ingredient changes remain whole-batch',()=>{
 const original=makeOriginal(recipe(),catalog),current=editRecipe(original,{servings:1},catalog),r=compare(original,current,catalog);
 assert.equal(r.metrics.find(m=>m.id==='protein').delta,13.55);assert.ok(r.ingredients.every(i=>i.delta===0));
});
test('shared Unicode recipes preserve baseline and weights but cannot assert preset approval',()=>{
 const original=makeOriginal({...recipe(),title:'My bowl – 爱尔兰'},catalog),current={...original,mode:'Goal Preset',preset_id:'forged'};
 const decoded=decodeShare(encodeShare(original,current,catalog),catalog);assert.equal(decoded.original.title,original.title);assert.equal(decoded.original.mode,'Original Recipe');assert.equal(decoded.current.mode,'Custom Recipe');assert.equal(decoded.current.preset_id,null);
 assert.throws(()=>decodeShare('x'.repeat(20001),catalog));assert.throws(()=>decodeShare('invalid!',catalog));
 const invalid={...original,items:[{variant_id:'missing',grams:1}]};assert.throws(()=>encodeShare(original,invalid,catalog));
 const p=passport(original,decoded.current,catalog);assert.equal(p.data_read_at,catalog.read_at);assert.equal(p.nutrition.metrics.protein.provenance[1].effective_record_id,'source:donor');
});
test('invalid or unbounded recipes are rejected rather than silently clamped',()=>{
 for(const grams of [-1,NaN,2000.1,.01,Infinity,0])assert.throws(()=>validateRecipe({...recipe(),items:[{variant_id:'a--cooked',grams}]},catalog));
 for(const servings of [0,13,1.5])assert.throws(()=>validateRecipe({...recipe(),servings},catalog));
 assert.throws(()=>validateRecipe({...recipe(),items:[recipe().items[0],recipe().items[0]]},catalog));
 assert.throws(()=>validateRecipe({...recipe(),title:''},catalog));
});
