// Memory only: no persisted nutrition snapshot or silent offline fallback.
// Navigation can reuse the current checked catalogue; refresh always reaches the API.
export function createCatalogClient({fetcher=globalThis.fetch,now=Date.now}={}){
 let snapshot=null,loadedAt=0,pending;
 return {
  getSnapshot:()=>snapshot,
  ageMs:()=>snapshot?now()-loadedAt:Infinity,
  refresh(){
   if(pending)return pending;
   pending=(async()=>{
    const response=await fetcher('/api/catalog',{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Live catalogue unavailable');
    const next=await response.json();
    if(next.data_mode!=='live'||!Array.isArray(next.ingredients)||!Array.isArray(next.recipes))throw Error('Invalid live catalogue');
    snapshot=next;loadedAt=now();return next;
   })().finally(()=>{pending=undefined;});
   return pending;
  }
 };
}
