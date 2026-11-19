// Social-media Passport card (1080×1350, 4:5 portrait for Instagram and Facebook feeds).
// Presentation only: every figure comes from the recipe engine's Passport report. No price is shown.
export const CARD_WIDTH=1080, CARD_HEIGHT=1350;
const C={ink:'#24243f',muted:'#5b6276',blue:'#294bd1',yellow:'#ffda42',yellowInk:'#65500e',purple:'#783ec2',red:'#d32d43',soft:'#f5f0fc',line:'#e5e2f0',leaf:'#3f9b47'};
const FONT='Arial, "Helvetica Neue", Helvetica, sans-serif';

const value=(nutrition,id)=>{const n=nutrition?.metrics?.[id];return n&&n.status==='complete'&&Number.isFinite(n.perServing)?n.perServing:null;};
const round=(x,d=0)=>x==null?null:Number(x.toFixed(d));
const shortName=name=>String(name||'').split(/[,(—]/)[0].trim();

// Pure: picks the headline figures and changes for the card.
export function passportCardModel(report,data,{image,name}={}){
 const nutrition=report.base_nutrition||report.nutrition,servings=report.current.servings||1;
 const per=id=>value(nutrition,id);
 const food=id=>data.ingredients.find(i=>i.variant_id===id);
 const before=new Map(report.original.items.map(i=>[i.variant_id,i.grams/report.original.servings]));
 const changes=report.current.items.map(i=>({id:i.variant_id,delta:i.grams/servings-(before.get(i.variant_id)||0)}))
  .concat(report.original.items.filter(i=>!report.current.items.some(c=>c.variant_id===i.variant_id)).map(i=>({id:i.variant_id,delta:-(i.grams/report.original.servings)})))
  .filter(c=>Math.abs(c.delta)>=0.5).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))
  .map(c=>`${c.delta>0?'+':'−'}${round(Math.abs(c.delta))} g ${shortName(food(c.id)?.name_en)}`);
 const sauce=report.current.sauce&&data.sauces?.find(s=>s.id===report.current.sauce.id);
 return {
  name:name||report.current.title,image,
  mode:changes.length?'My custom mix':'Original Recipe',
  bowlGrams:round(report.nutrition.weight/servings),
  sauce:sauce?.name||null,
  baseOnly:!!report.base_nutrition,
  kcal:round(per('energy_reported')),
  macros:[['Protein',per('protein'),C.blue],['Carbs',per('carbohydrate_by_difference'),C.yellow],['Fat',per('fat'),C.purple],['Fibre',per('fibre_total_dietary'),C.red]].map(([label,g,colour])=>({label,grams:round(g,1),colour})),
  changes:changes.slice(0,3)
 };
}

function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function cover(ctx,img,x,y,w,h){const s=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/s,sh=h/s;ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
function fitText(ctx,text,maxWidth,size,weight=800){let s=size;do{ctx.font=`${weight} ${s}px ${FONT}`;s-=2;}while(ctx.measureText(text).width>maxWidth&&s>24);return text;}
function pill(ctx,text,x,y,{bg,fg,border,size=26,padX=20,h=50}){ctx.font=`700 ${size}px ${FONT}`;const w=ctx.measureText(text).width+padX*2;rounded(ctx,x,y,w,h,h/2);ctx.fillStyle=bg;ctx.fill();if(border){ctx.lineWidth=2.5;ctx.strokeStyle=border;ctx.stroke();}ctx.fillStyle=fg;ctx.textBaseline='middle';ctx.fillText(text,x+padX,y+h/2+1);ctx.textBaseline='alphabetic';return w;}
// The horizontal logo cropped to letters, leaves and swoosh (same crop as the page stamp).
const LOGO_CROP=[225,40,1705,540];
function logo(ctx,img,x,y,h){const [sx,sy,sw,sh]=LOGO_CROP,w=h*sw/sh;ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();return w;}
function stamp(ctx,logoImg,cx,cy,r){
 ctx.save();ctx.translate(cx,cy);ctx.rotate(-14*Math.PI/180);
 ctx.shadowColor='rgba(36,36,63,.22)';ctx.shadowOffsetX=6;ctx.shadowOffsetY=8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.shadowColor='transparent';
 [C.blue,C.yellow,C.purple,C.red].forEach((c,i)=>{ctx.beginPath();ctx.arc(0,0,r-7,(-135+i*90)*Math.PI/180,(-45+i*90)*Math.PI/180);ctx.lineWidth=14;ctx.strokeStyle=c;ctx.stroke();});
 ctx.setLineDash([7,6]);ctx.lineWidth=2.5;ctx.strokeStyle='#cdb8ec';ctx.beginPath();ctx.arc(0,0,r-26,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 const lh=r*0.36,lw=lh*LOGO_CROP[2]/LOGO_CROP[3];logo(ctx,logoImg,-lw/2,-r*0.42,lh);
 ctx.fillStyle=C.purple;ctx.textAlign='center';ctx.font=`800 ${Math.round(r*0.19)}px ${FONT}`;
 ctx.fillText('F O O D',0,r*0.2);ctx.fillText('P A S S P O R T',0,r*0.43);ctx.textAlign='left';ctx.restore();
}

export function drawPassportCard(ctx,model,{photo,logoImg}){
 const W=CARD_WIDTH,H=CARD_HEIGHT,M=60;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 [C.blue,C.yellow,C.red,C.purple].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(i*W/4,0,W/4,14);});
 // Header: logo and label
 logo(ctx,logoImg,M,44,66);
 ctx.font=`800 24px ${FONT}`;const label='NUTRITION PASSPORT',lw=ctx.measureText(label).width+40;
 pill(ctx,label,W-M-lw,52,{bg:C.soft,fg:C.purple,size:24,h:50});
 // Photo
 const py=140,ph=560;ctx.save();rounded(ctx,M,py,W-2*M,ph,40);ctx.clip();if(photo)cover(ctx,photo,M,py,W-2*M,ph);else{ctx.fillStyle=C.soft;ctx.fillRect(M,py,W-2*M,ph);}ctx.restore();
 ctx.save();rounded(ctx,M,py,W-2*M,ph,40);ctx.lineWidth=3;ctx.strokeStyle=C.ink;ctx.stroke();ctx.restore();
 pill(ctx,model.mode,M+24,py+24,{bg:model.changes.length?C.yellow:'#fff',fg:C.ink,border:C.ink,size:26});
 stamp(ctx,logoImg,W-M-110,py+ph-30,112);
 // Title block
 ctx.fillStyle=C.ink;fitText(ctx,model.name,W-2*M-250,76,850);ctx.fillText(model.name,M,py+ph+100);
 ctx.font=`500 32px ${FONT}`;ctx.fillStyle=C.muted;
 ctx.fillText(`${model.bowlGrams} g per bowl${model.sauce?` · with ${model.sauce}`:''}`,M,py+ph+150);
 // Energy ring
 const cx=M+130,cy=py+ph+330,r=118,known=model.macros.slice(0,3).filter(m=>m.grams!=null),total=known.reduce((s,m)=>s+m.grams,0);
 ctx.lineWidth=30;ctx.strokeStyle='#eceffa';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
 if(known.length===3&&total>0){let a=-Math.PI/2;for(const m of known){const sweep=m.grams/total*Math.PI*2;ctx.strokeStyle=m.colour;ctx.beginPath();ctx.arc(cx,cy,r,a+0.03,a+sweep-0.03);ctx.stroke();a+=sweep;}}
 ctx.textAlign='center';ctx.fillStyle=C.ink;ctx.font=`900 70px ${FONT}`;ctx.fillText(model.kcal==null?'—':String(model.kcal),cx,cy+18);
 ctx.font=`800 24px ${FONT}`;ctx.fillStyle=C.muted;ctx.fillText('KCAL',cx,cy+54);ctx.textAlign='left';
 // Macro tiles
 const tx=M+300,tw=(W-M-tx-24)/2,th=118;
 model.macros.forEach((m,i)=>{const x=tx+(i%2)*(tw+24),y=cy-th-12+Math.floor(i/2)*(th+24);
  ctx.save();rounded(ctx,x+6,y+8,tw,th,26);ctx.fillStyle=m.colour;ctx.fill();rounded(ctx,x,y,tw,th,26);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=C.ink;ctx.stroke();ctx.restore();
  ctx.fillStyle=C.muted;ctx.font=`800 22px ${FONT}`;ctx.fillText(m.label.toUpperCase(),x+24,y+42);
  ctx.fillStyle=C.ink;ctx.font=`900 46px ${FONT}`;ctx.fillText(m.grams==null?'—':`${m.grams} g`,x+24,y+94);});
 // Changes
 let chipY=cy+r+52,chipX=M;
 if(model.changes.length){ctx.font=`800 22px ${FONT}`;ctx.fillStyle=C.purple;ctx.fillText('MY CHANGES',chipX,chipY+33);chipX+=ctx.measureText('MY CHANGES').width+20;
  for(const c of model.changes){ctx.font=`700 24px ${FONT}`;const w=ctx.measureText(c).width+36;if(chipX+w>W-M)break;chipX+=pill(ctx,c,chipX,chipY+8,{bg:c.startsWith('+')?'#f0f4ff':'#f5f0fc',fg:c.startsWith('+')?C.blue:C.purple,size:24,padX:18,h:44})+12;}}
 // Footer
 ctx.fillStyle=C.line;ctx.fillRect(M,H-82,W-2*M,2);
 ctx.fillStyle=C.ink;ctx.font=`900 30px ${FONT}`;ctx.fillText('colourfuel.ie',M,H-36);
 ctx.fillStyle=C.muted;ctx.font=`500 20px ${FONT}`;ctx.textAlign='right';
 ctx.fillText(`Concept preview · ${model.baseOnly?'base ingredients, excludes sauce':'listed ingredients'} · not medical advice`,W-M,H-38);ctx.textAlign='left';
}

const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('An image for the Passport could not load.'));img.src=src;});
export async function passportCardBlob(model){
 const [photo,logoImg]=await Promise.all([model.image?loadImage(model.image).catch(()=>null):null,loadImage('colourfuel-horizontal.jpg')]);
 const canvas=document.createElement('canvas');canvas.width=CARD_WIDTH;canvas.height=CARD_HEIGHT;
 drawPassportCard(canvas.getContext('2d'),model,{photo,logoImg});
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('The Passport image could not be created.')),'image/png'));
}
