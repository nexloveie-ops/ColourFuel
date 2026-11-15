import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set([
  'index.html', 'app.js', 'style.css', 'data.js', 'data.json',
  'salad-hero.jpg', 'salad-fresh.jpg', 'salad-glass.jpg', 'yogurt.jpg',
  'colourfuel-horizontal.jpg', 'colourfuel-round.jpg',
]);
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', jpg: 'image/jpeg' };

export async function handleRequest(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (pathname === '/healthz') {
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
  const server = createServer(handleRequest);
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('ColourFuel is listening on the configured PORT.'));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
