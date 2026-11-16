import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const files=new Set((await readdir(root)).filter(n=>/\.(html|css|js|mjs|jpg)$/.test(n)&&!n.includes('test')&&!['server.mjs','db.mjs','preview.mjs'].includes(n)));
const mime={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',jpg:'image/jpeg'};
createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
 if(pathname==='/api/catalog'){
  try{
   const response=await fetch('https://colourfuel-web-721850220313.europe-west1.run.app/api/catalog',{cache:'no-store',signal:AbortSignal.timeout(45000)});
   if(!response.ok)throw Error('Catalogue unavailable');
   const data=await response.json();
   if(data.data_mode!=='live'||!Array.isArray(data.ingredients)||!Array.isArray(data.recipes))throw Error('Invalid catalogue');
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   return res.end(req.method==='HEAD'?undefined:JSON.stringify(data));
  }catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'10'});return res.end('{"error":"Live catalogue temporarily unavailable. Please retry."}');}
 }
 const name=pathname.slice(1)||'index.html';
 if(!files.has(name)){res.writeHead(404);return res.end('Not found');}
 try{const body=await readFile(join(root,name));res.writeHead(200,{'Content-Type':mime[name.split('.').pop()],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500);res.end();}
}).listen(4187,'127.0.0.1',()=>console.log('ColourFuel preview: http://127.0.0.1:4187 — live catalogue read-only'));
