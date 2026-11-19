// Proposed kitchen-test standards, shared across Bowls. Financial fields stay unknown until costed.
export const PORTION_VERSION='standard-portions-v2';
const PROTEINS=['chicken-breast--roasted','tuna--cooked','pork-shavings--cooked','atlantic-salmon--cooked','chickpea--boiled','edamame--cooked'];
const VEG=['broccoli--raw','carrot--raw','red-pepper--raw','tomato--raw','cucumber--raw','purple-cabbage--raw','sweetcorn--cooked'];
const definition=(grams,step=1,method='Pre-weigh into labelled portion containers; confirm edible food state.')=>({grams,step,max:4,method,status:'proposed_kitchen_test',version:PORTION_VERSION,costCents:null,extraPriceCents:null,removalCreditCents:null,pricingStatus:'pending'});
export const PORTION_STANDARDS=Object.fromEntries([
 ...PROTEINS.map(id=>[id,definition(50)]),
 ...VEG.map(id=>[id,definition(50)]),
 ...['brown-rice--cooked','quinoa--cooked'].map(id=>[id,definition(50,.5,'Weigh cooked portions; calibrate a dedicated scoop before service.')]),
 ['spinach--raw',definition(25)],['feta--ready_to_eat',definition(25)],
 ['spring-onion--raw',definition(10,1,'Pre-weigh garnish portions.')],
 ['sesame-seed--toasted',definition(5,1,'Pre-weigh topping portions.')],
 ['olive-oil--ready_to_use',definition(5,1,'Pre-weigh oil; calibrate a dispenser before service.')]
]);
export function portionStandard(food){
 const known=PORTION_STANDARDS[food.variant_id];
 if(known)return {...known};
 // Extra library ingredients get an explicit suggested starting standard, never a verified kitchen claim.
 const grams=['oil','spice','seed','herb','condiment'].includes(food.category)?5:50;
 return {...definition(grams),status:'suggested_starting_standard'};
}
export function sauceStandard(sauce){return {...definition(sauce.default_grams),min:1,max:3,method:'Pre-weigh into sauce cups; validate cup fill or pump delivery before service.'};}
const tenth=n=>Math.round(n*10)/10;
export function portionCount(grams,servings,standard){return grams/servings/standard.grams;}
export function isStandardCount(count,standard){return Number.isFinite(count)&&count>=0&&count<=standard.max&&Math.abs(count/standard.step-Math.round(count/standard.step))<1e-7;}
export function portionGrams(count,servings,standard,{required=false}={}){
 if(!Number.isInteger(servings)||servings<1||servings>12)throw Error('Choose 1–12 bowls.');
 if(!isStandardCount(count,standard)||(required&&count<1))throw Error(`Use ${required?'1':0}–${standard.max} portions in steps of ${standard.step}.`);
 const grams=tenth(count*standard.grams*servings);
 if(grams>2000)throw Error('This batch exceeds 2,000 g for one ingredient. Reduce the bowl count or portions.');
 return grams;
}
export function changePortion(recipe,id,count,food){
 const next=structuredClone(recipe),standard=portionStandard(food);
 const row=next.items.find(i=>i.variant_id===id);if(!row)throw Error('Ingredient not found.');
 row.grams=portionGrams(count,recipe.servings,standard);return next;
}
export function resizeBatch(recipe,servings){
 if(!Number.isInteger(servings)||servings<1||servings>12)throw Error('Choose 1–12 bowls.');
 const next=structuredClone(recipe),factor=servings/recipe.servings;
 if([...recipe.items.map(i=>i.grams),...(recipe.sauce?[recipe.sauce.grams]:[])].some(g=>Math.abs(g*factor*10-Math.round(g*factor*10))>1e-7))throw Error('These custom weights cannot scale exactly in 0.1 g increments. Keep this batch size or choose standard portions first.');
 next.servings=servings;next.items=next.items.map(i=>({...i,grams:tenth(i.grams*factor)}));
 if(next.sauce)next.sauce.grams=tenth(next.sauce.grams*factor);
 if(next.items.some(i=>i.grams>2000)||next.sauce?.grams>2000)throw Error('This batch exceeds 2,000 g for one ingredient. Reduce the bowl count.');
 return next;
}
// Unit cost and customer pricing are separate. Null values never become zero or invented quotes.
export function portionPricing(original,current,foods,sauces,baseTargetCents,{foodStandard=portionStandard,saucePortion=sauceStandard,allowDemo=false}={}){
 let cost=0,adjustment=0;const missingCost=[],missingPrice=[],lines=[];let usedDemo=false;
 const originalById=new Map(original.items.map(i=>[i.variant_id,i.grams/original.servings]));
 const ids=new Set([...originalById.keys(),...current.items.map(i=>i.variant_id)]);
 function account(id,count,before,standard){
  const verified=standard.pricingStatus==='verified',demo=allowDemo&&standard.pricingStatus==='demo';usedDemo ||= demo;
  if(count>0){if(verified&&Number.isFinite(standard.costCents)&&standard.costCents>=0)cost+=count*standard.costCents;else missingCost.push(id);}
  const delta=count-before;if(Math.abs(delta)<1e-7)return;
  const rate=delta>0?standard.extraPriceCents:standard.removalCreditCents;
  if((verified||demo)&&Number.isFinite(rate)&&rate>=0){const amount=Math.round(delta*rate)||0;adjustment+=amount;lines.push({id,delta,unitPriceCents:rate,amountCents:Math.round(amount),demo});}else missingPrice.push(id);
 }
 for(const id of ids){const food=foods.find(i=>i.variant_id===id),standard=foodStandard(food);account(id,(current.items.find(i=>i.variant_id===id)?.grams||0)/current.servings/standard.grams,(originalById.get(id)||0)/standard.grams,standard);}
 if(current.bowl_product_id&&!current.sauce)missingCost.push('required-sauce');
 if(current.sauce){const s=sauces.find(s=>s.id===current.sauce.id),standard=saucePortion(s);account('sauce:'+s.id,current.sauce.grams/current.servings/standard.grams,1,standard);}
 return {ingredientCostCents:missingCost.length?null:Math.round(cost),targetPriceCents:baseTargetCents==null||missingPrice.length?null:Math.max(0,Math.round(baseTargetCents+adjustment)),missingCost,missingPrice,lines,adjustmentCents:Math.round(adjustment),pricingMode:usedDemo?'demo':'verified_or_pending'};
}
export function portionSnapshot(recipe,foods,sauces){
 const rows=recipe.items.filter(i=>i.grams>0).map(row=>{const food=foods.find(f=>f.variant_id===row.variant_id),standard=portionStandard(food),count=portionCount(row.grams,recipe.servings,standard);return {variant_id:row.variant_id,name:food.name_en,state:food.state,standard_grams:standard.grams,portions_per_bowl:count,grams_per_bowl:row.grams/recipe.servings,batch_grams:row.grams,standard_count:isStandardCount(count,standard),method:standard.method};});
 if(recipe.sauce){const sauce=sauces.find(s=>s.id===recipe.sauce.id),standard=sauceStandard(sauce),count=portionCount(recipe.sauce.grams,recipe.servings,standard);rows.push({sauce_id:sauce.id,name:sauce.name,standard_grams:standard.grams,portions_per_bowl:count,grams_per_bowl:recipe.sauce.grams/recipe.servings,batch_grams:recipe.sauce.grams,standard_count:isStandardCount(count,standard)&&count>=1,method:standard.method});}
 return {version:PORTION_VERSION,status:'proposed_kitchen_test',bowls:recipe.servings,rows};
}

// Invented interaction-test charges only. Real cost/price fields above remain pending.
export const DEMO_EXTRA_PRICES={
 'chicken-breast--roasted':150,'atlantic-salmon--cooked':200,'tuna--cooked':150,'pork-shavings--cooked':175,
 'chickpea--boiled':50,'edamame--cooked':75,'brown-rice--cooked':50,'quinoa--cooked':60,
 'spinach--raw':30,'feta--ready_to_eat':75,'spring-onion--raw':10,'sesame-seed--toasted':15,'olive-oil--ready_to_use':10,
 ...Object.fromEntries(VEG.map(id=>[id,40]))
};
export function demoFoodStandard(food){return {...portionStandard(food),pricingStatus:'demo',extraPriceCents:DEMO_EXTRA_PRICES[food.variant_id]??50,removalCreditCents:0};}
export function demoSauceStandard(sauce){return {...sauceStandard(sauce),pricingStatus:'demo',extraPriceCents:50,removalCreditCents:0};}
