import {referenceBar,referenceNote} from './nutrition-context.mjs';
import {bowlSauces} from './sauce-content.mjs';
import {calculate,fromCatalog,compare} from './recipe-engine.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(n,d=1)=>n==null?'—':Number(n).toLocaleString('en-IE',{maximumFractionDigits:d});
export const PRODUCTS=[
  {
    "product_id": "everyday-chicken",
    "name": "Everyday Chicken",
    "illustrative_price_cents": 795,
    "accent": "gold",
    "collection": "Everyday value",
    "rd": false,
    "image": "rainbow-chicken.jpg",
    "small": "rainbow-chicken-small.jpg",
    "description": "Chicken, colourful vegetables & grains.",
    "colours": [],
    "ingredients": "Roasted chicken \u00b7 brown rice \u00b7 broccoli \u00b7 carrot \u00b7 red pepper \u00b7 olive oil",
    "image_note": "Photo shows our Rainbow Chicken \u00b7 illustrative",
    "recipe_id": "sample-menu-everyday-chicken"
  },
  {
    "product_id": "rainbow-chicken",
    "name": "Rainbow Chicken",
    "illustrative_price_cents": 895,
    "accent": "gold",
    "collection": "The colourful classic",
    "rd": false,
    "image": "rainbow-chicken.jpg",
    "small": "rainbow-chicken-small.jpg",
    "description": "Golden chicken. Crisp vegetables. Colour in every forkful.",
    "colours": [],
    "ingredients": "Roasted chicken \u00b7 quinoa \u00b7 broccoli \u00b7 carrot \u00b7 red pepper \u00b7 olive oil",
    "image_note": "Illustrative photo",
    "recipe_id": "sample-rainbow-chicken"
  },
  {
    "product_id": "plant-power-crunch",
    "name": "Plant Power Crunch",
    "illustrative_price_cents": 895,
    "accent": "green",
    "collection": "Plant-inspired colour",
    "rd": false,
    "image": "vegan-power.jpg",
    "small": "vegan-power-small.jpg",
    "description": "Chickpeas, leafy greens & a colourful crunch.",
    "colours": [],
    "ingredients": "Chickpeas \u00b7 quinoa \u00b7 baby spinach \u00b7 carrot \u00b7 red pepper \u00b7 olive oil",
    "image_note": "Illustrative photo",
    "recipe_id": "sample-vegan-power"
  },
  {
    "product_id": "mediterranean-garden",
    "name": "Mediterranean Garden",
    "illustrative_price_cents": 895,
    "accent": "green",
    "collection": "A Mediterranean direction",
    "rd": false,
    "image": "mediterranean-garden.jpg",
    "small": "mediterranean-garden-small.jpg",
    "description": "Bright vegetables, chickpeas & a little feta.",
    "colours": [],
    "ingredients": "Quinoa \u00b7 chickpeas \u00b7 cherry tomato \u00b7 cucumber \u00b7 baby spinach \u00b7 feta \u00b7 olive oil",
    "image_note": "AI-generated illustration",
    "recipe_id": "sample-menu-mediterranean-garden"
  },
  {
    "product_id": "asian-sesame-crunch",
    "name": "Asian Sesame Crunch",
    "illustrative_price_cents": 995,
    "accent": "gold",
    "collection": "A sesame-inspired direction",
    "rd": false,
    "image": "asian-sesame-crunch.jpg",
    "small": "asian-sesame-crunch-small.jpg",
    "description": "Toasty sesame. Colourful vegetables. Plenty of texture.",
    "colours": [],
    "ingredients": "Brown rice \u00b7 cooked edamame \u00b7 purple cabbage \u00b7 carrot \u00b7 cucumber \u00b7 spring onion \u00b7 sesame",
    "image_note": "AI-generated illustration",
    "recipe_id": "sample-menu-asian-sesame-crunch"
  },
  {
    "product_id": "coastal-colour",
    "name": "Coastal Colour",
    "illustrative_price_cents": 995,
    "accent": "coral",
    "collection": "Inspired by the coast",
    "rd": false,
    "image": "coastal-colour.jpg",
    "small": "coastal-colour-small.jpg",
    "description": "Flaked tuna, sweetcorn & a fresh green crunch.",
    "colours": [],
    "ingredients": "Cooked tuna \u00b7 brown rice \u00b7 baby spinach \u00b7 cherry tomato \u00b7 cucumber \u00b7 sweetcorn",
    "image_note": "AI-generated illustration",
    "recipe_id": "sample-menu-coastal-colour"
  },
  {
    "product_id": "crispy-pork",
    "name": "Crispy Pork",
    "illustrative_price_cents": 1095,
    "accent": "coral",
    "collection": "Texture in development",
    "rd": true,
    "image": "crispy-pork.jpg",
    "small": "crispy-pork-small.jpg",
    "description": "Crisp pork shavings & bright, crunchy vegetables.",
    "colours": [],
    "ingredients": "Fully cooked crisp pork shavings \u00b7 brown rice \u00b7 purple cabbage \u00b7 carrot \u00b7 cucumber \u00b7 baby spinach",
    "image_note": "AI-generated illustration \u00b7 in the test kitchen",
    "recipe_id": "sample-menu-crispy-pork"
  },
  {
    "product_id": "signature-salmon",
    "name": "Signature Salmon",
    "illustrative_price_cents": 1195,
    "accent": "coral",
    "collection": "Our signature in development",
    "rd": true,
    "image": "signature-salmon.jpg",
    "small": "signature-salmon-small.jpg",
    "description": "Flaky salmon, earthy grains & a fresh green crunch.",
    "colours": [],
    "ingredients": "Fully cooked salmon \u00b7 brown rice \u00b7 baby spinach \u00b7 tomato \u00b7 cucumber \u00b7 olive oil",
    "image_note": "Illustrative photo \u00b7 in the test kitchen",
    "recipe_id": "sample-signature-salmon"
  }
];
export const storyFor=recipeId=>recipeId?PRODUCTS.find(p=>p.recipe_id===recipeId):undefined;
export function productPhoto(product,{small=false,priority=false,className='',caption=false}={}){
 if(!product?.image)return '';
 return `<figure class="food-figure ${className}"><img src="${esc(small?product.small:product.image)}" ${product.small?`srcset="${esc(product.small)} 600w, ${esc(product.image)} 1200w" sizes="${small?'(max-width:700px) 90vw, 33vw':'(max-width:700px) 100vw, 55vw'}"`:''} width="1200" height="800" alt="${esc(product.name)}: ${esc(product.ingredients||'serving inspiration')}" decoding="async" ${priority?'fetchpriority="high"':'loading="lazy"'}>${caption?`<figcaption>${esc(product.image_note||'Illustrative recipe concept · not a final product photo')}</figcaption>`:''}</figure>`;
}
export function colourRibbon(product){return `<ul class="food-colours" aria-label="Colours in this bowl">${product.colours.map(([colour,label])=>`<li><i class="food-dot ${colour}" aria-hidden="true"></i>${esc(label)}</li>`).join('')}</ul>`;}
function quickNutrition(recipe,data){const r=recipe?calculate(fromCatalog(recipe),data):null;return `<div class="bowl-nutrition" aria-label="Nutrition per serving">${[['energy_reported','Energy','kcal'],['protein','Protein','g'],['fat','Fat','g']].map(([id,label,unit])=>`<div><strong>${number(r?.metrics[id]?.perServing,id==='energy_reported'?0:1)}<small>${unit}</small></strong><span>${label}</span></div>`).join('')}</div>`;}
export function productPage(id,data){
 const p=PRODUCTS.find(p=>p.product_id===id);
 if(!p)return '<div class="wrap empty"><h1>Let’s find your bowl.</h1><a href="#products">Explore the menu</a></div>';
 return `<article class="wrap bowl-page"><a class="back" href="#products">All our bowls</a><div class="bowl-hero">${p.image?productPhoto(p,{priority:true,caption:true}):`<div class="concept-art ${p.accent}"><span>COLOURFUEL BOWL</span><strong>${esc(p.name)}</strong><small>Recipe in development · photography pending</small></div>`}<div class="bowl-intro"><div class="eyebrow">${p.rd?'TEST KITCHEN · NOT AVAILABLE TO ORDER':'CONCEPT TEST MENU'}</div><h1>${esc(p.name)}</h1>${dietaryBadge(p,{detail:true})}<p class="bowl-lead">${esc(p.collection)}</p><div class="product-price"><strong>€${(p.illustrative_price_cents/100).toFixed(2)}</strong><span>Target price · not final</span></div><p>${esc(p.description)}</p><div class="bowl-proposed-ingredients"><h2>Suggested ingredients to test</h2><p>${esc(p.ingredients)}</p><small>Illustrative ingredient direction, not a confirmed recipe or a complete allergen declaration. Final quantities, portion size and preparation remain to be tested.</small></div><p>Target prices have not been validated against ingredient costs or nutritional calculations. Final recipes, portions, nutrition and allergens remain under review.</p><button class="outline-button" disabled>${p.rd?'R&D testing · unavailable to order':'Concept only · ordering unavailable'}</button><p class="small-note">No stock availability is represented.</p><a class="inline-link" href="#sauces">Explore the sauce candidates</a></div></div>${pendingEditor(p)}${bowlSauces(p,PRODUCTS)}</article>`;
}
// Shown only until the live catalogue is ready (or if it is unavailable): read-only, no gram inputs.
function pendingEditor(p){return `<section class="inline-pending-editor studio-layout"><section class="mix-panel" aria-labelledby="mix-title" aria-busy="true"><div class="panel-heading"><h2 id="mix-title">Make it yours.</h2><span>Standard portions · per bowl</span></div><p class="builder-context-note" role="status">Loading this bowl’s standard portions from the live ingredient data. Portion sliders appear as soon as it’s ready.</p><ul class="pending-ingredients">${p.ingredients.split(' · ').map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section><aside class="comparison-panel"><div class="eyebrow">KNOW YOUR BOWL</div><h2>See what changes.</h2><p>Nutrition appears with the portions. Missing values are never shown as zero.</p><button class="outline-button" data-action="refresh-data">Refresh ingredient data</button></aside></section>`;}
export function recipeVisual(recipe,data){const p=storyFor(recipe.source_recipe_id);if(p)return p;const base=data.recipes.find(r=>r.recipe_id===recipe.source_recipe_id);return base?{name:base.title_en,image:base.image,ingredients:base.items.map(i=>i.name).join(' · ')}:null;}
export function dietaryBadge(product,{detail=false}={}){
 const id=product?.product_id;
 const vegan=['plant-power-crunch','asian-sesame-crunch'].includes(id),vegetarian=id==='mediterranean-garden';
 if(!vegan&&!vegetarian)return '';
 const label=vegan?'Vegan base':'Vegetarian concept';
 const note=vegan?'Original recipe base uses plant ingredients. Choose a suitable sauce; additions and recipe changes may alter dietary suitability.':'Contains feta. Vegetarian-suitable cheese and rennet must be confirmed before release. Sauce choice and recipe changes may alter suitability.';
 return `<span class="dietary-badge ${vegan?'vegan':'vegetarian'}" title="${note}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4C11 3 4 7 5 14c1 6 10 7 13 1 2-4 2-8 2-11Z"/><path d="M4 21 15 10M9 16l-1-5m5 1 4 1"/></svg>${label}</span>${detail?`<p class="dietary-note">${note}</p>`:''}`;
}
export function passportMarkup(report,data){
 const {current,original}=report,full=report.nutrition,r=report.base_nutrition||full,baseOnly=!!report.base_nutrition,visual=recipeVisual(current,data),changes=compare(original,current,data);
 const changed=changes.ingredients.map(i=>({...i,delta:i.after/current.servings-i.before/original.servings})).filter(i=>Math.abs(i.delta)>.001),custom=current.mode==='Custom Recipe'||changed.length>0,comparison=report.base_comparison||report.comparison;
 const basis=baseOnly?'Base ingredients only · excludes sauce':'Listed recipe ingredients';
 const complete=Object.values(r.metrics).filter(n=>n.status==='complete').length;
 return `<div class="passport"><div class="passport-cover"><div class="passport-stamp" aria-hidden="true"><span class="stamp-logo"><img src="colourfuel-horizontal.jpg" alt="" width="2172" height="724" decoding="async"></span><small>FOOD</small><small>PASSPORT</small></div>${productPhoto(visual,{priority:true})}<div class="passport-cover-copy"><div class="eyebrow">YOUR BOWL, AT A GLANCE</div><h3>${esc(current.title)}</h3><p>${current.servings} serving${current.servings===1?'':'s'} · ${number(full.weight/current.servings)} g per serving${baseOnly?' including sauce':''}</p><span class="passport-version">${esc(current.mode)}${report.preset?' · '+esc(report.preset.label):''}</span></div></div><p class="passport-image-note">${custom?'Image shows the original serving concept. Your ingredient changes are reflected in the figures below.':'Serving image is illustrative. Nutrition follows the listed edible weights.'}</p><section class="passport-nutrition-scope"><h3>${basis}</h3><p>Nutrition below describes ${number(r.weight/current.servings)} g of ${baseOnly?'base ingredients':'ingredients'} per serving, calculated from your current edible weights.${baseOnly?' Sauce weight is included in the cover weight above, but its nutrients are not included below.':''}</p></section><div class="passport-highlights">${[['energy_reported','Energy','kcal'],['protein','Protein','g'],['fat','Fat','g']].map(([id,label,unit])=>`<div><span>${label}</span><strong>${number(r.metrics[id]?.perServing,1)}<small>${unit}</small></strong>${referenceBar(id,r.metrics[id]?.perServing,unit)}</div>`).join('')}</div><p class="passport-basis">Per serving · ${basis} · food-composition estimate</p>${referenceNote()}${baseOnly?'<p class="full-bowl-pending"><b>Full bowl totals are pending.</b> Your required sauce adds energy and nutrients. Its unquantified values are not zero and are not presented as complete bowl totals.</p>':''}<details class="passport-details passport-comparison"><summary>What changed from your Original Recipe?</summary><p>${basis} · per serving</p><div class="passport-comparison-labels"><span>Nutrient</span><span>Original</span><span>Current</span><span>Change</span></div>${comparison.filter(n=>['energy_reported','protein','fat','saturated_fat','salt','fibre_total_dietary'].includes(n.id)).map(n=>`<div class="passport-comparison-row"><span>${esc(n.after.name)}<small>${esc(n.after.unit)}</small></span><span>${number(n.before.perServing,2)}</span><strong>${number(n.after.perServing,2)}</strong><span>${n.delta==null?'Pending':(n.delta>0?'+':'')+number(n.delta,2)}</span></div>`).join('')}</details>${changed.length?`<section class="passport-changes"><h3>Your own take.</h3><p>${changed.map(i=>{const food=data.ingredients.find(x=>x.variant_id===i.variant_id);return `${i.delta>0?'+':'−'}${number(Math.abs(i.delta))} g ${esc(food?.name_en)}`;}).join(' · ')} per bowl, compared with your Original Recipe.</p></section>`:''}${report.standard_portions?`<details class="passport-details"><summary>Standard portions &amp; kitchen weights</summary><p>${esc(report.standard_portions.version)} · suggested kitchen-test standards, not validated service specifications. ${current.servings} bowls in this batch.</p>${report.standard_portions.rows.map(row=>`<p><b>${esc(row.name)}</b><br>${number(row.portions_per_bowl,4)} portion${Math.abs(row.portions_per_bowl-1)<1e-7?'':'s'} × ${row.standard_grams} g = ${number(row.grams_per_bowl)} g / bowl · ${number(row.batch_grams)} g in batch${row.standard_count?'':' · custom weight retained'}<br>${esc(row.method)}</p>`).join('')}</details>`:''}<h3>What’s in your bowl</h3>${current.sauce?`<p class="passport-sauce"><strong>Required sauce: ${esc(data.sauces.find(s=>s.id===current.sauce.id)?.name)}</strong> · ${number(current.sauce.grams/current.servings)} g per serving<br>Included in recipe weight. Complete bowl nutrition awaits the weighed sauce formulation.</p>`:''}<div class="passport-ingredients">${current.items.filter(i=>i.grams>0).map(i=>{const food=data.ingredients.find(f=>f.variant_id===i.variant_id);return `<div><span>${esc(food.name_en)}<small>${esc(food.edible_description||food.state)}</small></span><strong>${number(i.grams/current.servings)} g</strong></div>`;}).join('')}</div><details class="passport-details passport-nutrient-details"><summary>All nutrients &amp; data coverage</summary><p><b>${basis}</b> · per serving. ${complete} of ${Object.keys(r.metrics).length} nutrient totals have numeric coverage for every active base ingredient. Missing values and source trace entries remain explicit.</p>${Object.values(r.metrics).map(n=>`<div class="passport-row"><span>${esc(n.name)}</span><strong>${n.status==='complete'?number(n.perServing,3)+' '+esc(n.unit):n.status==='trace'?'Source trace · total unresolved':'Incomplete base data'}</strong>${n.status==='complete'?referenceBar(n.id,n.perServing,n.unit):`<small class="passport-coverage">${n.knownTotal>0?'Known subtotal: '+number(n.knownTotal/current.servings,3)+' '+esc(n.unit)+' per serving; not a complete total. ':''}${n.missing} unresolved ingredient record${n.missing===1?'':'s'}; ${n.trace} trace record${n.trace===1?'':'s'}.</small>`}${n.references?'<small class="passport-coverage">Includes explicitly matched reference estimates.</small>':''}</div>`).join('')}</details><details class="passport-details"><summary>Follow the ingredients to their sources</summary>${current.items.filter(i=>i.grams>0).map(i=>{const food=data.ingredients.find(f=>f.variant_id===i.variant_id);return `<p><b>${esc(food.name_en)}</b> · ${esc(food.record_id)}<br>${esc(food.source_name)}<br><a href="${esc(food.source_url||'https://fdc.nal.usda.gov/')}" target="_blank" rel="noopener noreferrer">Open food source</a></p>`;}).join('')}${data.datasets.map(d=>`<p>${esc(d.publisher)} · ${esc(d.version)}<br>Retrieved ${esc(d.retrieved_on)}</p>`).join('')}<p>Data checked ${esc(new Date(data.read_at).toLocaleString('en-IE'))}</p></details><details class="passport-details"><summary>How to read your Passport</summary>${report.limitations.map(t=>`<p>${esc(t)}</p>`).join('')}</details><p class="passport-footnote">Development estimate. Kitchen and allergen reviews are pending; this is not a shop label or medical advice.</p><div class="passport-actions"><button class="button" data-studio-action="download">Download full report</button><button class="outline-button" data-studio-action="print">Print Passport</button></div></div>`;
}
