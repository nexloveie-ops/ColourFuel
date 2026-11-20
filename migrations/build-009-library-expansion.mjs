// Build 009 from the checked capture (fixtures/library-expansion-009.json). No credentials or connection settings.
import { readFile, writeFile } from 'node:fs/promises'; import { createHash } from 'node:crypto';
const capture = await readFile(new URL('../fixtures/library-expansion-009.json', import.meta.url), 'utf8');
const sha = createHash('sha256').update(capture).digest('hex');
if (sha !== (await readFile(new URL('../fixtures/library-expansion-009.sha256', import.meta.url), 'utf8')).trim()) throw Error('Capture checksum mismatch');
const count = JSON.parse(capture).foods.length;
const sql = (await readFile(new URL('./009_library_expansion.template.sql', import.meta.url), 'utf8'))
  .replace('__CAPTURE_JSON__', "'" + JSON.stringify(JSON.parse(capture)).replaceAll("'", "''") + "'").replaceAll('__CAPTURE_SHA256__', sha).replaceAll('__FOOD_COUNT__', String(count));
await writeFile(new URL('./009_library_expansion.sql', import.meta.url), sql);
console.log(`Prepared 009 (${count} foods) from capture ${sha}; SQL SHA-256 ${createHash('sha256').update(sql).digest('hex')}`);
