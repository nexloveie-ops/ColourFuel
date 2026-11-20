import {prepareWebCatalog} from './web-catalog.mjs';
// Authentication uses the Cloud Run service identity; no database password is used.
let poolPromise;
let connector;
async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const [{ Connector }, { default: pg }] = await Promise.all([
        import('@google-cloud/cloud-sql-connector'), import('pg'),
      ]);
      connector = new Connector();
      const options = await connector.getOptions({
        instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
        authType: 'IAM', ipType: 'PUBLIC',
      });
      const pool = new pg.Pool({
        ...options, user: process.env.DB_USER, database: process.env.DB_NAME || 'colourfuel',
        max: 3, connectionTimeoutMillis: 12000, idleTimeoutMillis: 300000,
        statement_timeout: 20000, query_timeout: 22000,
        options: '-c default_transaction_read_only=on',
      });
      pool.on('error', error => console.error('Database pool error', error.code || error.name));
      return pool;
    })().catch(error => {
      poolPromise = undefined;
      connector?.close();
      throw error;
    });
  }
  return poolPromise;
}

async function queryCatalog() {
  if (!process.env.INSTANCE_CONNECTION_NAME || !process.env.DB_USER) throw new Error('Database configuration missing');
  const pool = await getPool();
  // One statement gives all recipe and ingredient data a consistent database snapshot.
  const { rows } = await pool.query('SELECT payload FROM colourfuel_web.catalog');
  const payload = rows[0]?.payload;
  if (!payload || payload.data_mode !== 'live' || !Array.isArray(payload.ingredients) || !Array.isArray(payload.recipes)) {
    throw new Error('Invalid live catalogue');
  }
  return prepareWebCatalog(payload,(text,values)=>pool.query(text,values));
}

// The checked catalogue (database view + PostgreSQL rankings) is reused for a few minutes per
// instance: a stale copy is served while one refresh runs in the background, and photo additions
// invalidate it. Values always come from the database; nothing is computed or stored elsewhere.
export const CATALOG_TTL_MS=5*60_000;
let pendingCatalog,cachedCatalog;
function refreshCatalog(query,now){
  if(!pendingCatalog)pendingCatalog=query().then(value=>{cachedCatalog={value,at:now};return value;}).finally(()=>{pendingCatalog=undefined;});
  return pendingCatalog;
}
export function readCatalog({query=queryCatalog,now=Date.now()}={}){
  if(cachedCatalog&&now-cachedCatalog.at<CATALOG_TTL_MS)return Promise.resolve(cachedCatalog.value);
  if(cachedCatalog){refreshCatalog(query,now).catch(error=>console.error('Catalogue refresh failed',error.code||error.name));return Promise.resolve(cachedCatalog.value);}
  return refreshCatalog(query,now);
}
export function invalidateCatalog(){cachedCatalog=undefined;}

/**
 * Adds one sourced food through colourfuel_catalog.add_photo_food (migration 007). The runtime
 * account can execute only that validated function; it has no direct table write access.
 */
export async function addPhotoFood(payload) {
  if (!process.env.INSTANCE_CONNECTION_NAME || !process.env.DB_USER) throw new Error('Database configuration missing');
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN READ WRITE');
    const { rows } = await client.query('SELECT colourfuel_catalog.add_photo_food($1::jsonb) AS variant_id', [JSON.stringify(payload)]);
    await client.query('COMMIT');
    return rows[0].variant_id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

/** Replaces the placeholder of a photo-added food with a Commons image (migration 008 function). */
export async function setPhotoFoodImage(variantId, info, bytes) {
  if (!process.env.INSTANCE_CONNECTION_NAME || !process.env.DB_USER) throw new Error('Database configuration missing');
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN READ WRITE');
    const { rows } = await client.query('SELECT colourfuel_catalog.set_photo_food_image($1, $2::jsonb, $3) AS path', [variantId, JSON.stringify(info), bytes]);
    await client.query('COMMIT');
    return rows[0].path;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

/** Stored image bytes for an `ingredient-photo-…jpg` path, or null. */
export async function readPhotoImage(path) {
  if (!process.env.INSTANCE_CONNECTION_NAME || !process.env.DB_USER) throw new Error('Database configuration missing');
  const { rows } = await (await getPool()).query('SELECT colourfuel_catalog.photo_image_bytes($1) AS bytes', [path]);
  return rows[0]?.bytes || null;
}

export async function closeDatabase() {
  if (poolPromise) {
    try { await (await poolPromise).end(); } finally { connector?.close(); }
  }
}
