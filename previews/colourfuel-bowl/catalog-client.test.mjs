import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogClient} from './catalog-client.mjs';
const data={data_mode:'live',ingredients:[],recipes:[]};
test('navigation reads memory without making another nutrition request; explicit refresh reads the server',async()=>{
 let calls=0,time=0;const client=createCatalogClient({now:()=>time,fetcher:async()=>({ok:true,json:async()=>({...data,revision:++calls})})});
 assert.equal(client.getSnapshot(),null);await client.refresh();time=5000;assert.equal(client.ageMs(),5000);
 assert.equal(client.getSnapshot().revision,1);assert.equal(client.getSnapshot().revision,1);assert.equal(calls,1);
 await client.refresh();assert.equal(client.getSnapshot().revision,2);
});
test('concurrent refreshes share the same in-flight request',async()=>{
 let calls=0,resolve;const client=createCatalogClient({fetcher:()=>{calls++;return new Promise(r=>resolve=r);}});
 const first=client.refresh(),second=client.refresh();assert.equal(first,second);assert.equal(calls,1);
 resolve({ok:true,json:async()=>data});await first;assert.equal(client.getSnapshot().data_mode,'live');
});
test('failed refresh is surfaced and never advances the previous checked snapshot',async()=>{
 let fail=false,time=0;const client=createCatalogClient({now:()=>time,fetcher:async()=>({ok:!fail,json:async()=>data})});
 await client.refresh();fail=true;time=60000;await assert.rejects(client.refresh());assert.equal(client.ageMs(),60000);assert.equal(client.getSnapshot(),data);
 fail=false;await client.refresh();assert.equal(client.ageMs(),0);
});
