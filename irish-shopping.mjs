// Buying evidence is loaded from persistent tables in the checked catalogue response.
export let IRISH_RETAILERS=[];
export let IRISH_BUYING_REFERENCES=[];
export function hydrateIrishShopping(catalog,{validateOnly=false}={}){
 const retailers=catalog.irish_retailers,refs=catalog.irish_buying_references;
 if(!Array.isArray(retailers)||!retailers.length||!Array.isArray(refs))throw Error('Database Irish buying evidence unavailable');
 const ids=new Set(retailers.map(r=>r.id)),foods=new Set(catalog.ingredients.map(f=>f.ingredient_id));
 if(ids.size!==retailers.length||refs.some(r=>!ids.has(r.retailer_id)||!foods.has(r.ingredient_id)||!/^https:\/\//.test(r.url)||!r.product||!r.pack||!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewed_on)))throw Error('Invalid database Irish buying references');
 if(!validateOnly){IRISH_RETAILERS=retailers;IRISH_BUYING_REFERENCES=refs;}
}
export function buyingOptions(food){return IRISH_BUYING_REFERENCES.filter(item=>item.ingredient_id===food.ingredient_id);}
export function ingredientsAtRetailer(foods,retailer='all'){return retailer==='all'?foods:foods.filter(food=>buyingOptions(food).some(item=>item.retailer_id===retailer));}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buyingSummary(food){
 const options=buyingOptions(food);const shops=[...new Set(options.map(item=>IRISH_RETAILERS.find(shop=>shop.id===item.retailer_id).name))];
 return options.length?`<small class="ingredient-buying-summary">Ireland · ${shops.map(esc).join(' · ')}</small>`:'';
}
export function buyingPanel(food){
 const options=buyingOptions(food);
 return `<section class="ingredient-buying-panel" aria-label="Irish buying references"><div class="eyebrow">SHOPPING IN IRELAND</div><h3>Where to buy in Ireland</h3><p>Review dates are shown on each buying reference. Check the retailer for current stock, price, delivery area and the latest pack label. These products do not supply the nutrition figures in this library.</p>${options.length?`<ul>${options.map(item=>`<li><div class="buying-option-heading"><strong>${esc(IRISH_RETAILERS.find(shop=>shop.id===item.retailer_id).name)}</strong><span class="buying-match">${item.evidence_type==='range'?'Range reference':item.match==='prepare'?'Preparation needed':item.match==='alternative'?'Buying alternative':'Ingredient reference'}</span></div><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.product)} ↗</a><small>${esc(item.pack)} · Source reviewed ${item.reviewed_on}</small>${item.note?`<p>${esc(item.note)}</p>`:''}</li>`).join('')}</ul>`:'<p>A matching Irish buying reference has not yet been verified for this ingredient.</p>'}<p class="buying-scope-note">Buying reference only · supplier approval and nutrition equivalence are not implied. Recipe quantities are edible weights, which may differ from the weight on a retail pack.</p></section>`;
}
export function retailerGuide(){return `<details class="irish-shopping-guide"><summary>Shopping in Ireland · retailers & source coverage</summary><p>Open any ingredient to see its buying references, pack sizes and preparation differences. Product and range references are distinguished below. M&S and Donnybrook Fair are store enquiries; no ingredient-specific availability is claimed.</p><div class="retailer-guide-grid">${IRISH_RETAILERS.map(shop=>`<article><a href="${esc(shop.url)}" target="_blank" rel="noopener noreferrer">${esc(shop.name)} ↗</a><span>${shop.directory_only?'Store enquiry':shop.id==='lidl'?'Range reference':'Product references'}</span><p>${esc(shop.note)}</p></article>`).join('')}</div><p>Sources reviewed 17 November 2026. Stock and prices are not tracked live. Irish retail availability does not establish Irish-grown origin.</p></details>`;}
