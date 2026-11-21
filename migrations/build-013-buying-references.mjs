// Build 013 (SuperValu buying references for library ingredients that had none) from the checked fixture.
// Usage: node migrations/build-013-buying-references.mjs
// Every reference is a public SuperValu product page matched by hand; the fixture records product, pack, match type and note.
// Nothing here supplies nutrition, stock or price. The generated SQL is small and committed.
import { readFile, writeFile } from 'node:fs/promises'; import { createHash } from 'node:crypto';
const sha = b => createHash('sha256').update(b).digest('hex');
const text = await readFile(new URL('../fixtures/buying-references-013.json', import.meta.url), 'utf8');
if (sha(text) !== (await readFile(new URL('../fixtures/buying-references-013.sha256', import.meta.url), 'utf8')).trim()) throw Error('Fixture checksum mismatch');
const fixture = JSON.parse(text);
const refs = fixture.references;
const ids = new Set();
for (const r of refs) {
  if (ids.has(r.ingredient_id)) throw Error(`${r.ingredient_id}: more than one reference`); ids.add(r.ingredient_id);
  if (r.retailer_id !== 'supervalu' || !/^https:\/\/shop\.supervalu\.ie\/product\/[^\s'"]+-id-\d+$/.test(r.url)) throw Error(`${r.ingredient_id}: not a SuperValu product URL`);
  if (!r.product || !r.pack || r.reviewed_on !== fixture.reviewed_on || r.evidence_type !== 'product' || !['ingredient', 'prepare', 'alternative'].includes(r.match)) throw Error(`${r.ingredient_id}: incomplete reference`);
  if (r.match !== 'ingredient' && !r.note) throw Error(`${r.ingredient_id}: ${r.match} needs a note`);
}
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const NOTE = 'Product listings across the ColourFuel library: lentils, beans and fennel (reviewed 17 November 2026) and a wider range of ingredients (reviewed 21 November 2026). Choose a local store to check delivery and availability.';
const sql = `-- 013: SuperValu buying references for ${refs.length} library ingredients that had none (fixture ${sha(text)}).
-- Adds rows only; existing references, foods, nutrition and photos stay untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='009_library_expansion') THEN RAISE EXCEPTION 'Migration 009 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='013_buying_references') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;
CREATE TEMP TABLE new_ref(ord integer PRIMARY KEY, ingredient_id text NOT NULL UNIQUE, url text NOT NULL, product text NOT NULL, pack text NOT NULL, match_type text NOT NULL, note text NOT NULL) ON COMMIT DROP;
INSERT INTO new_ref VALUES
${refs.map((r, i) => `(${i + 1},${q(r.ingredient_id)},${q(r.url)},${q(r.product)},${q(r.pack)},${q(r.match)},${q(r.note)})`).join(',\n')};
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM new_ref n LEFT JOIN colourfuel_catalog.ingredient i USING(ingredient_id) WHERE i.ingredient_id IS NULL) THEN RAISE EXCEPTION 'Reference for an unknown ingredient'; END IF;
 IF EXISTS(SELECT 1 FROM new_ref n JOIN colourfuel_catalog.buying_reference b USING(ingredient_id)) THEN RAISE EXCEPTION 'Ingredient already has a buying reference'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel_catalog.retailer WHERE retailer_id='supervalu') THEN RAISE EXCEPTION 'SuperValu retailer missing'; END IF;
END $$;
CREATE TEMP TABLE old_note ON COMMIT DROP AS SELECT payload->>'note' AS note FROM colourfuel_catalog.retailer WHERE retailer_id='supervalu';
INSERT INTO colourfuel_catalog.buying_reference(ingredient_id,retailer_id,url,product,pack,reviewed_on,evidence_type,match_type,note,display_order)
 SELECT ingredient_id,'supervalu',url,product,pack,${q(fixture.reviewed_on)}::date,'product',match_type,note,(SELECT max(display_order) FROM colourfuel_catalog.buying_reference)+ord FROM new_ref;
UPDATE colourfuel_catalog.retailer SET payload=jsonb_set(payload,'{note}',to_jsonb(${q(NOTE)}::text)) WHERE retailer_id='supervalu';
DO $$ DECLARE c jsonb; BEGIN
 IF (SELECT count(*) FROM colourfuel_catalog.buying_reference b JOIN new_ref n USING(ingredient_id))<>(SELECT count(*) FROM new_ref) THEN RAISE EXCEPTION 'Reference insert count failed'; END IF;
 SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
 IF jsonb_array_length(c->'irish_buying_references')<>(SELECT count(*) FROM colourfuel_catalog.buying_reference) THEN RAISE EXCEPTION 'Catalogue view does not show the references'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.buying_reference','INSERT') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('013_buying_references', jsonb_build_object('fixture_sha256',${q(sha(text))},'references',(SELECT count(*) FROM new_ref),'reviewed_on',${q(fixture.reviewed_on)},'previous_supervalu_note',(SELECT note FROM old_note),'ingredients',(SELECT jsonb_agg(ingredient_id ORDER BY ingredient_id) FROM new_ref)));
COMMIT;
`;
await writeFile(new URL('./013_buying_references.sql', import.meta.url), sql);
console.log(`Prepared 013 with ${refs.length} references; SQL SHA-256 ${sha(sql)}`);
