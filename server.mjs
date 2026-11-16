import { PUBLIC_ASSETS } from './public-assets.mjs';
import { createServer } from 'node:http';
import {gzipSync} from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog, closeDatabase } from './db.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set(PUBLIC_ASSETS);
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', jpg: 'image/jpeg' };

const assetCache=new Map();
const acceptsGzip=req=>(req.headers?.['accept-encoding']||'').split(',').some(part=>{const [encoding,...params]=part.trim().split(';');const quality=params.find(p=>p.trim().startsWith('q='));return encoding.trim().toLowerCase()==='gzip'&&(!quality||Number(quality.trim().slice(2))>0);});
export async function handleRequest(req, res, dependencies = { readCatalog }) {
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
      const json=Buffer.from(JSON.stringify(catalog));const compressed=acceptsGzip(req);const body=compressed?gzipSync(json):json;
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
