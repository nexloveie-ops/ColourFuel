import { PUBLIC_ASSETS } from './public-assets.mjs';
import { createServer } from 'node:http';
import {gzipSync} from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog, invalidateCatalog, closeDatabase, addPhotoFood, setPhotoFoodImage, readPhotoImage } from './db.mjs';
import { attachFoodPhotos, placeholderFoods, searchCommons, chooseCommonsPhoto, downloadJpeg } from './food-photos.mjs';
import { addMissingFoods, searchUsda, chooseUsdaRecord } from './food-additions.mjs';
import { estimatePhoto, readPhotoRequest, photoErrorResponse, createPhotoLimiter, MAX_BODY_BYTES } from './photo-estimate.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set(PUBLIC_ASSETS);
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', jpg: 'image/jpeg' };

const assetCache=new Map();
const acceptsGzip=req=>(req.headers?.['accept-encoding']||'').split(',').some(part=>{const [encoding,...params]=part.trim().split(';');const quality=params.find(p=>p.trim().startsWith('q='));return encoding.trim().toLowerCase()==='gzip'&&(!quality||Number(quality.trim().slice(2))>0);});
const json=(res,status,value,extra={})=>{const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(body);};
const readBody=(req,limit)=>new Promise((ok,fail)=>{const parts=[];let size=0;req.on('data',c=>{size+=c.length;if(size>limit){fail(Object.assign(Error('too large'),{status:413}));req.destroy?.();}else parts.push(c);});req.on('end',()=>ok(Buffer.concat(parts)));req.on('error',fail);});
const clientId=req=>String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'unknown';
let photoCatalog={at:0,value:null};
async function catalogForPhotos(read){if(!photoCatalog.value||Date.now()-photoCatalog.at>600_000)photoCatalog={at:Date.now(),value:await read()};return photoCatalog.value;}
const defaultPhotoLimiter=createPhotoLimiter();
const defaults={readCatalog,invalidateCatalog,estimatePhoto,photoLimiter:defaultPhotoLimiter,photoEnabled:()=>!!process.env.ANTHROPIC_API_KEY,addMissingFoods,foodLookups:{searchUsda,chooseUsdaRecord,addPhotoFood},attachFoodPhotos,photoLookups:{searchCommons,chooseCommonsPhoto,downloadJpeg,setPhotoFoodImage},readPhotoImage};

async function handlePhotoEstimate(req,res,deps){
  if(req.method==='GET'||req.method==='HEAD'){json(res,200,{available:deps.photoEnabled(),stores_photos:false});return;}
  if(req.method!=='POST'){res.writeHead(405,{Allow:'GET, HEAD, POST'});res.end();return;}
  if(!deps.photoEnabled()){json(res,503,{error:'Photo estimate is not available right now.'});return;}
  if(!/^application\/json\b/i.test(req.headers?.['content-type']||'')){json(res,415,{error:'Send the photo as JSON.'});return;}
  let body;
  try{body=JSON.parse((await readBody(req,MAX_BODY_BYTES)).toString('utf8'));}
  catch(error){json(res,error.status===413?413:400,{error:error.status===413?'The photo is too large. Please use a smaller image.':'The photo could not be read.'});return;}
  const photo=readPhotoRequest(body);
  if(photo.error){json(res,400,{error:photo.error});return;}
  if(!deps.photoLimiter(clientId(req))){json(res,429,{error:'You have reached the photo estimate limit for now. Please try again later.'},{'Retry-After':'3600'});return;}
  try{
    const catalog=await catalogForPhotos(deps.readCatalog);
    const result=await deps.estimatePhoto({image:photo.image,mediaType:photo.mediaType,catalog});
    // Foods missing from the library: add them from a pack label or USDA record, then return their records.
    const added=deps.addMissingFoods?await deps.addMissingFoods(result,catalog,deps.foodLookups):[];
    if(added.length){
      photoCatalog={at:0,value:null};deps.invalidateCatalog?.();
      let fresh=await catalogForPhotos(deps.readCatalog);
      if(!added.every(id=>fresh.ingredients.some(f=>f.variant_id===id))){photoCatalog={at:0,value:null};deps.invalidateCatalog?.();fresh=await catalogForPhotos(deps.readCatalog);}
    }
    // Photo-added foods still showing the placeholder get an openly licensed Commons photo.
    let current=added.length?photoCatalog.value:catalog;
    // Foods in this photo first, then one earlier photo-added food still without a photo.
    const inPhoto=result.foods.filter(f=>f.variant_id&&f.source!=='library').map(f=>f.variant_id);
    const needPhoto=[...inPhoto,...placeholderFoods(current||{}).filter(id=>!inPhoto.includes(id)).slice(0,1)];
    const pictured=deps.attachFoodPhotos&&needPhoto.length?await deps.attachFoodPhotos(needPhoto,current,deps.photoLookups,{limit:inPhoto.length+1}):[];
    if(pictured.length){photoCatalog={at:0,value:null};deps.invalidateCatalog?.();current=await catalogForPhotos(deps.readCatalog);}
    // Full records of every matched food, so the app can calculate even if its copy of the
    // library predates foods added from other photos.
    const lib=new Map((current?.ingredients||[]).map(f=>[f.variant_id,f]));
    for(const food of result.foods)if(food.variant_id&&!lib.has(food.variant_id)){food.variant_id=null;food.source='not_found';}
    result.food_records=[...new Set(result.foods.map(f=>f.variant_id).filter(Boolean))].map(id=>lib.get(id));
    const photos=new Map((current?.ingredient_photos||[]).map(p=>[p.variant_id,p]));
    result.food_photos=result.food_records.map(f=>photos.get(f.variant_id)).filter(Boolean);
    json(res,200,result);
  }catch(error){
    const failure=photoErrorResponse(error);
    console.error('Photo estimate failed',failure.status,error?.constructor?.name||'Error'); // never logs the photo
    json(res,failure.status,{error:failure.message});
  }
}

const photoImageCache=new Map();
// Serialised (and gzipped on first use) once per catalogue snapshot, not per request.
const catalogBodyCache=new WeakMap();
function catalogBodies(catalog){
  let entry=catalogBodyCache.get(catalog);
  if(!entry){const json=Buffer.from(JSON.stringify(catalog));let gz;entry={json,gzip:()=>gz??=gzipSync(json)};catalogBodyCache.set(catalog,entry);}
  return entry;
}

async function servePhotoImage(name,req,res,deps){
  try{
    let bytes=photoImageCache.get(name);
    if(!bytes){bytes=await deps.readPhotoImage(name);if(bytes){photoImageCache.set(name,bytes);if(photoImageCache.size>100)photoImageCache.delete(photoImageCache.keys().next().value);}}
    if(!bytes){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){console.error('Photo image unavailable',error?.code||error?.name);res.writeHead(503);res.end('Image temporarily unavailable');}
}

export async function handleRequest(req, res, dependencies = defaults) {
  dependencies={...defaults,...dependencies};
  let photoPath;
  try { photoPath = new URL(req.url, 'http://localhost').pathname === '/api/photo-estimate'; } catch { photoPath = false; }
  if (photoPath) { await handlePhotoEstimate(req, res, dependencies); return; }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname === '/api/catalog') {
    try {
      const started=performance.now();
      const catalog = await dependencies.readCatalog();
      const queryMs=performance.now()-started;
      const {json,gzip}=catalogBodies(catalog);const compressed=acceptsGzip(req);const body=compressed?gzip():json;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary':'Accept-Encoding', 'Content-Length':body.length,...compressed?{'Content-Encoding':'gzip'}:{},'Server-Timing':`catalog;dur=${queryMs.toFixed(1)}` });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error('Live catalogue unavailable', error.code || error.name);
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '10' });
      res.end(req.method === 'HEAD' ? undefined : '{"error":"Catalogue temporarily unavailable. Please try again."}');
    }
    return;
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : '{"status":"ok","service":"colourfuel-web"}'); return;
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (/^ingredient-photo-[a-z0-9]+(-[a-z0-9]+)*--[a-z_]+\.jpg$/.test(name) && !publicFiles.has(name)) { await servePhotoImage(name, req, res, dependencies); return; }
  if (!publicFiles.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    if(!assetCache.has(name))assetCache.set(name,readFile(resolve(root,name)).then(body=>({body,gzip:/\.(?:html|css|mjs|js)$/.test(name)?gzipSync(body):null})).catch(error=>{assetCache.delete(name);throw error;}));
    const asset=await assetCache.get(name),compressed=acceptsGzip(req)&&!!asset.gzip;
    const body=compressed?asset.gzip:asset.body;
    res.writeHead(200, {
      'Content-Type': mime[name.split('.').pop()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Vary':'Accept-Encoding',...compressed?{'Content-Encoding':'gzip'}:{},
      'Cache-Control': name.endsWith('.jpg') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500); res.end('Could not load this page');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Serve food imagery immediately while the connection warms. Nutrition still fails closed.
  if(process.env.NODE_ENV==='production')readCatalog().catch(error=>console.error('Database warm-up unavailable',error.code||error.name));
  const server = createServer((req, res) => handleRequest(req, res));
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('ColourFuel is listening on the configured PORT.'));
  process.on('SIGTERM', () => server.close(async () => { await closeDatabase(); process.exit(0); }));
}
