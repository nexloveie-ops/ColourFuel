// Colour Pop presentation effects. Visual only: values come from the recipe engine; nothing here calculates nutrition or prices.
import {INGREDIENT_PHOTOS} from './ingredient-photos.mjs';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=0)=>Number(x).toLocaleString('en-IE',{maximumFractionDigits:d});
export const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??true;
const finePointer=()=>globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches??false;

// Descriptive flavour colours for the sauce selection fill; never a nutrition or health signal.
export const SAUCE_COLOURS={'classic-caesar':'#e9cf7a','honey-mustard':'#f2b51d','balsamic-vinaigrette':'#7a2f45','basil-pesto':'#4f9a3a','roasted-sesame':'#c0803f','citrus-mint':'#f28c28','smoky-chipotle-ranch':'#d0602f','sweet-chilli':'#d32d43'};
export const photoFor=id=>INGREDIENT_PHOTOS[id]?.image||null;
export function thumbStyle(image){return image?`--thumb-img:url('${esc(image)}');`:'';}
const shortName=name=>String(name).split(/[,(—]/)[0].trim();

// 1 · Exploded bowl: ingredient photo chips sized by grams per bowl around the bowl photo.
let stagePrev=new Map();
function chipSize(grams,max){return grams>0?(12+10*Math.sqrt(grams/max)).toFixed(2):"10";}
export function bowlStageMarkup(visual,chips){
 const max=Math.max(...chips.map(c=>c.grams),1),step=360/Math.max(chips.length,1);
 stagePrev=new Map(chips.map(c=>[c.id,c.grams]));
 return `<figure class="bowl-stage-figure"><div class="bowl-stage" id="bowl-stage"><div class="bowl-stage-plate"><img src="${esc(visual.small||visual.image)}" srcset="${esc(visual.small||visual.image)} 600w, ${esc(visual.image)} 1200w" sizes="(max-width:700px) 60vw, 30vw" alt="${esc(visual.name)}: ${esc(visual.ingredients||'')}" width="1200" height="800" fetchpriority="high"></div><ul class="bowl-stage-chips" aria-label="What’s in this bowl, per bowl">${chips.map((c,i)=>{const a=(-90+i*step)*Math.PI/180;return `<li class="bowl-chip ${c.sauce?'is-sauce':''} ${c.grams>0?'':'is-empty'}" data-chip="${esc(c.id)}" style="--x:${(50+37*Math.cos(a)).toFixed(2)}%;--y:${(50+37*Math.sin(a)).toFixed(2)}%;--chip:${chipSize(c.grams,max)}%;--i:${i};${c.colour?`--sauce:${c.colour};`:''}"><span class="bowl-chip-photo">${c.image?`<img src="${esc(c.image)}" alt="" width="160" height="120" loading="lazy" decoding="async">`:''}</span><span class="bowl-chip-label"><span>${esc(shortName(c.name))}</span><b data-chip-grams>${fmt(c.grams,1)} g</b></span></li>`;}).join('')}</ul></div><figcaption>${esc(visual.image_note||'Illustrative photo')} · Photo chips grow with grams per bowl; they are not the plated look.</figcaption></figure>`;
}
export function updateBowlStage(chips){
 const stage=document.querySelector('#bowl-stage');if(!stage)return;
 const max=Math.max(...chips.map(c=>c.grams),1);
 for(const c of chips){
  const li=stage.querySelector(`[data-chip="${CSS.escape(c.id)}"]`);if(!li)continue;
  const before=stagePrev.get(c.id)??c.grams,delta=c.grams-before;
  li.style.setProperty('--chip',chipSize(c.grams,max)+'%');li.classList.toggle('is-empty',!(c.grams>0));
  li.querySelector('[data-chip-grams]').textContent=fmt(c.grams,1)+' g';
  if(Math.abs(delta)>1e-6&&!reducedMotion()){
   li.classList.remove('chip-pop');void li.offsetWidth;li.classList.add('chip-pop');
   const bubble=document.createElement('span');bubble.className='chip-bubble '+(delta>0?'up':'down');bubble.setAttribute('aria-hidden','true');bubble.textContent=(delta>0?'+':'−')+fmt(Math.abs(delta),1)+' g';li.append(bubble);bubble.addEventListener('animationend',()=>bubble.remove());
  }
  stagePrev.set(c.id,c.grams);
 }
}

// 2 · Nutrition ring with counting numbers. Ring = share of combined macronutrient grams.
const MACROS=[['protein','Protein'],['carbohydrate_by_difference','Carbohydrate'],['fat','Fat']];
const shown=new Map();
export function nutriHeroMarkup(note){
 return `<div class="nutri-hero" id="nutri-hero" role="group" aria-label="Key figures per bowl"><div class="nutri-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="50"/>${MACROS.map(([id])=>`<circle class="ring-seg seg-${id}" data-seg="${id}" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="0 100"/>`).join('')}</svg><div class="nutri-ring-centre"><strong data-count="energy_reported">—</strong><span>kcal</span></div></div><ul class="nutri-legend">${MACROS.map(([id,label])=>`<li class="seg-${id}"><i aria-hidden="true"></i><span>${label}</span><b><span data-count="${id}">—</span> g</b></li>`).join('')}</ul><p class="nutri-hero-note">${esc(note)}</p></div>`;
}
function countTo(el,key,target,digits){
 if(target==null){el.textContent='—';shown.delete(key);return;}
 const from=shown.get(key);shown.set(key,target);
 if(from==null||reducedMotion()||Math.abs(from-target)<1e-6){el.textContent=fmt(target,digits);return;}
 const start=performance.now(),dur=520;
 const tick=now=>{const t=Math.min(1,(now-start)/dur),e=1-Math.pow(1-t,3);el.textContent=fmt(from+(target-from)*e,digits);if(t<1&&shown.get(key)===target)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
}
export function updateNutriHero(report,{reset=false}={}){
 const hero=document.querySelector('#nutri-hero');if(!hero)return;if(reset)shown.clear();
 const value=id=>{const n=report.metrics.find(m=>m.id===id);return n&&n.after.status==='complete'?n.after.perServing:null;};
 countTo(hero.querySelector('[data-count="energy_reported"]'),'energy_reported',value('energy_reported'),0);
 const grams=MACROS.map(([id])=>value(id)),total=grams.every(g=>g!=null)?grams.reduce((a,b)=>a+b,0):0;
 let offset=0;
 MACROS.forEach(([id],i)=>{countTo(hero.querySelector(`[data-count="${id}"]`),id,grams[i],1);const seg=hero.querySelector(`[data-seg="${id}"]`),share=total>0?grams[i]/total*100:0;seg.setAttribute('stroke-dasharray',`${Math.max(0,share-1.2).toFixed(2)} ${(100-Math.max(0,share-1.2)).toFixed(2)}`);seg.setAttribute("stroke-dashoffset",(-offset).toFixed(2));offset+=share;});
}

// 3 · Price flip board and dropping breakdown lines.
const lastPrice=new Map();let lastLines=null;
export function flipPrices(root=document){
 root.querySelectorAll('[data-flip]').forEach(el=>{
  const key=el.dataset.flip,text=el.textContent,prev=lastPrice.get(key);lastPrice.set(key,text);
  const pad=prev?Math.max(0,text.length-prev.length):0;
  el.innerHTML=[...text].map((ch,i)=>{const old=prev?.[i-pad];const flip=prev!=null&&old!==ch&&!reducedMotion();return `<span class="flip-char${flip?' is-flipping':''}" style="--d:${i*45}ms" aria-hidden="true">${esc(ch)}</span>`;}).join('')+`<span class="sr-only">${esc(text)}</span>`;
 });
 const lines=[...root.querySelectorAll('[data-line]')];const keys=new Set(lines.map(l=>l.dataset.line));
 if(lastLines&&!reducedMotion())lines.forEach((l,i)=>{if(!lastLines.has(l.dataset.line)){l.classList.add('line-drop');l.style.setProperty('--d',i*60+'ms');}});
 lastLines=keys;
}
export function resetPriceMemory(){lastPrice.clear();lastLines=null;}

// 4 · Readout pulse when a block slider moves.
export function pulse(el){if(!el||reducedMotion())return;el.classList.remove('readout-pop');void el.offsetWidth;el.classList.add('readout-pop');}

// 5 · Sauce pour: animate only when the selected sauce changes.
let lastSauce;
export function pourSauce(selectedId){
 if(selectedId&&lastSauce!==undefined&&selectedId!==lastSauce&&!reducedMotion())document.querySelector(`.sauce-choice input[value="${CSS.escape(selectedId)}"]`)?.closest('.sauce-choice')?.classList.add('just-poured');
 lastSauce=selectedId||null;
}
export function resetSauceMemory(){lastSauce=undefined;}

// 6 · Menu card tilt for fine pointers.
let tiltReady=false;
export function initTilt(){
 if(tiltReady)return;tiltReady=true;
 document.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse'||!finePointer()||reducedMotion())return;
  const card=e.target.closest?.('.product-card');if(!card)return;
  const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  card.style.transform=`perspective(900px) rotateX(${(-y*7).toFixed(2)}deg) rotateY(${(x*9).toFixed(2)}deg) translateY(-6px)`;card.classList.add('is-tilting');
 });
 document.addEventListener('pointerout',e=>{const card=e.target.closest?.('.product-card');if(card&&!card.contains(e.relatedTarget)){card.style.transform='';card.classList.remove('is-tilting');}});
}
