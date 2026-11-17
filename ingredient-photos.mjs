export let INGREDIENT_PHOTOS={};
export function hydrateIngredientPhotos(catalog,{validateOnly=false}={}){
 if(!Array.isArray(catalog.ingredient_photos)||catalog.ingredient_photos.length!==catalog.ingredients.length)throw Error('Database ingredient photos unavailable');
 const photos=Object.fromEntries(catalog.ingredient_photos.map(p=>[p.variant_id,p]));
 if(Object.keys(photos).length!==catalog.ingredients.length||catalog.ingredients.some(f=>!photos[f.variant_id]||!/^[a-z0-9_-]+\.jpg$/.test(photos[f.variant_id].image)||!(photos[f.variant_id].width>0&&photos[f.variant_id].height>0)))throw Error('Invalid database ingredient photos');
 if(!validateOnly)INGREDIENT_PHOTOS=photos;
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function ingredientPhoto(food){const p=INGREDIENT_PHOTOS[food.variant_id];return p?`<span class="ingredient-card-photo"><img src="${esc(p.image)}" alt="${esc(food.name_en)} — illustrative ingredient photograph" width="${p.width}" height="${p.height}" loading="lazy" decoding="async">${p.generated?'<small class="ingredient-ai-mark">AI illustration</small>':''}</span>`:'';}
export function ingredientImageDetail(food){const p=INGREDIENT_PHOTOS[food.variant_id];return p?`<figure class="ingredient-detail-photo"><img src="${esc(p.image)}" alt="${esc(food.name_en)} — ingredient identification image" width="${p.width}" height="${p.height}"><figcaption>${p.generated?'AI-created ingredient concept':'Illustrative ingredient photo'} · nutrition and preparation state follow the food record. This is not a verified supplier photograph.<br>Photo: ${esc(p.artist)} · ${p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>`:esc(p.title)} · ${p.license_url?`<a href="${esc(p.license_url)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a>`:esc(p.license)}. Resized / JPEG encoded.</figcaption></figure>`:'';}
