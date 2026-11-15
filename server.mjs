import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog, closeDatabase } from './db.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set([
  'index.html', 'app.js', 'style.css', 'studio.css', 'recipe-engine.mjs', 'recipe-studio.mjs',
  'salad-hero.jpg', 'salad-fresh.jpg', 'salad-glass.jpg', 'yogurt.jpg',
  'colourfuel-horizontal.jpg', 'colourfuel-round.jpg',
]);
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', jpg: 'image/jpeg' };

export async function handleRequest(req, res, dependencies = { readCatalog }) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname === '/api/catalog') {
    try {
      const catalog = await dependencies.readCatalog();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(catalog));
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
    const body = await readFile(resolve(root, name));
    res.writeHead(200, {
      'Content-Type': mime[name.split('.').pop()] || 'application/octet-stream',
      'Content-Length': body.length,
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
  // A production revision must read the database before accepting traffic.
  if (process.env.NODE_ENV === 'production') {
    try { await readCatalog(); }
    catch (error) { console.error('Database startup check failed', error.code || error.name); process.exit(1); }
  }
  const server = createServer((req, res) => handleRequest(req, res));
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('ColourFuel is listening on the configured PORT.'));
  process.on('SIGTERM', () => server.close(async () => { await closeDatabase(); process.exit(0); }));
}
