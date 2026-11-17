// Reproduce the reviewed import from a public-data capture. No credentials or connection settings.
import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
const source=await readFile(new URL('../fixtures/persistent-catalog-source.json',import.meta.url),'utf8');
const sha=createHash('sha256').update(source).digest('hex');
if(sha!==(await readFile(new URL('../fixtures/persistent-catalog-source.sha256',import.meta.url),'utf8')).trim())throw Error('Source capture checksum mismatch');
const sql=(await readFile(new URL('./006_persistent_catalog.template.sql',import.meta.url),'utf8')).replace('__SOURCE_JSON__',"'"+source.replaceAll("'","''")+"'").replace('__SOURCE_SHA256__',sha);
await writeFile(new URL('./006_persistent_catalog.sql',import.meta.url),sql);console.log('Prepared migration from checked capture:',sha);
