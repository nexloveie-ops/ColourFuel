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

let pendingCatalog;
export function readCatalog(){
  if(!pendingCatalog)pendingCatalog=queryCatalog().finally(()=>{pendingCatalog=undefined;});
  return pendingCatalog;
}

export async function closeDatabase() {
  if (poolPromise) {
    try { await (await poolPromise).end(); } finally { connector?.close(); }
  }
}
