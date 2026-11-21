// Build 015 (buying references from more Irish shops for library ingredients still without one after 013).
// Usage: node migrations/build-015-buying-references.mjs
// Every reference is a public product listing matched by hand; the fixture records shop, product, pack, match type and note.
// Adds three retailers (Asia Market, Evergreen Healthfoods, Fallon & Byrne) and widens The Village Butcher's note.
// Nothing here supplies nutrition, stock or price. The generated SQL is small and committed.
import { readFile, writeFile } from 'node:fs/promises'; import { createHash } from 'node:crypto';
const sha = b => createHash('sha256').update(b).digest('hex');
const text = await readFile(new URL('../fixtures/buying-references-015.json', import.meta.url), 'utf8');
if (sha(text) !== (await readFile(new URL('../fixtures/buying-references-015.sha256', import.meta.url), 'utf8')).trim()) throw Error('Fixture checksum mismatch');
const fixture = JSON.parse(text);
const HOSTS = { 'asia-market': /^https:\/\/www\.asiamarket\.ie\/products\/[a-z0-9-]+$/, evergreen: /^https:\/\/evergreen\.ie\/products\/[a-z0-9-]+$/,
  'fallon-byrne': /^https:\/\/www\.fallonandbyrne\.com\/shop\/[a-z0-9/-]+\/$/, 'village-butcher': /^https:\/\/thevillagebutcher\.ie\/product\/[a-z0-9-]+\/$/ };
const newShops = new Set(fixture.retailers.map(r => r.id));
for (const r of fixture.retailers) if (!HOSTS[r.id] || !/^https:\/\//.test(r.url) || !r.name || !r.note) throw Error(`${r.id}: incomplete retailer`);
for (const id of Object.keys(fixture.retailer_notes)) if (newShops.has(id) || !HOSTS[id]) throw Error(`${id}: note for an unexpected retailer`);
const ids = new Set();
for (const r of fixture.references) {
  if (ids.has(r.ingredient_id)) throw Error(`${r.ingredient_id}: more than one reference`); ids.add(r.ingredient_id);
  if (!HOSTS[r.retailer_id]?.test(r.url)) throw Error(`${r.ingredient_id}: not a product URL for ${r.retailer_id}`);
  if (!r.product || !r.pack || r.reviewed_on !== fixture.reviewed_on || r.evidence_type !== 'product' || !['ingredient', 'prepare', 'alternative'].includes(r.match)) throw Error(`${r.ingredient_id}: incomplete reference`);
  if (r.match !== 'ingredient' && !r.note) throw Error(`${r.ingredient_id}: ${r.match} needs a note`);
}
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const refs = fixture.references;
const sql = `-- 015: buying references from more Irish shops for ${refs.length} library ingredients that had none (fixture ${sha(text)}).
-- Adds retailers and reference rows and widens one retailer note; foods, nutrition, photos and existing references stay untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='013_buying_references') THEN RAISE EXCEPTION 'Migration 013 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='015_buying_references') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;
CREATE TEMP TABLE new_shop(ord integer PRIMARY KEY, retailer_id text NOT NULL UNIQUE, payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO new_shop VALUES
${fixture.retailers.map((r, i) => `(${i + 1},${q(r.id)},${q(JSON.stringify(r))}::jsonb)`).join(',\n')};
CREATE TEMP TABLE shop_note(retailer_id text PRIMARY KEY, note text NOT NULL) ON COMMIT DROP;
INSERT INTO shop_note VALUES
${Object.entries(fixture.retailer_notes).map(([id, n]) => `(${q(id)},${q(n)})`).join(',\n')};
CREATE TEMP TABLE new_ref(ord integer PRIMARY KEY, ingredient_id text NOT NULL UNIQUE, retailer_id text NOT NULL, url text NOT NULL, product text NOT NULL, pack text NOT NULL, match_type text NOT NULL, note text NOT NULL) ON COMMIT DROP;
INSERT INTO new_ref VALUES
${refs.map((r, i) => `(${i + 1},${q(r.ingredient_id)},${q(r.retailer_id)},${q(r.url)},${q(r.product)},${q(r.pack)},${q(r.match)},${q(r.note)})`).join(',\n')};
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM new_shop n JOIN colourfuel_catalog.retailer r USING(retailer_id)) THEN RAISE EXCEPTION 'Retailer already exists'; END IF;
 IF EXISTS(SELECT 1 FROM shop_note n LEFT JOIN colourfuel_catalog.retailer r USING(retailer_id) WHERE r.retailer_id IS NULL) THEN RAISE EXCEPTION 'Retailer to update is missing'; END IF;
 IF EXISTS(SELECT 1 FROM new_ref n LEFT JOIN colourfuel_catalog.ingredient i USING(ingredient_id) WHERE i.ingredient_id IS NULL) THEN RAISE EXCEPTION 'Reference for an unknown ingredient'; END IF;
 IF EXISTS(SELECT 1 FROM new_ref n JOIN colourfuel_catalog.buying_reference b USING(ingredient_id)) THEN RAISE EXCEPTION 'Ingredient already has a buying reference'; END IF;
END $$;
CREATE TEMP TABLE old_note ON COMMIT DROP AS SELECT r.retailer_id, r.payload->>'note' AS note FROM colourfuel_catalog.retailer r JOIN shop_note USING(retailer_id);
INSERT INTO colourfuel_catalog.retailer(retailer_id,display_order,payload)
 SELECT retailer_id,(SELECT max(display_order) FROM colourfuel_catalog.retailer)+ord,payload FROM new_shop;
UPDATE colourfuel_catalog.retailer r SET payload=jsonb_set(r.payload,'{note}',to_jsonb(n.note)) FROM shop_note n WHERE r.retailer_id=n.retailer_id;
INSERT INTO colourfuel_catalog.buying_reference(ingredient_id,retailer_id,url,product,pack,reviewed_on,evidence_type,match_type,note,display_order)
 SELECT ingredient_id,retailer_id,url,product,pack,${q(fixture.reviewed_on)}::date,'product',match_type,note,(SELECT max(display_order) FROM colourfuel_catalog.buying_reference)+ord FROM new_ref;
DO $$ DECLARE c jsonb; BEGIN
 IF (SELECT count(*) FROM colourfuel_catalog.buying_reference b JOIN new_ref n USING(ingredient_id,retailer_id))<>(SELECT count(*) FROM new_ref) THEN RAISE EXCEPTION 'Reference insert count failed'; END IF;
 SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
 IF jsonb_array_length(c->'irish_buying_references')<>(SELECT count(*) FROM colourfuel_catalog.buying_reference) THEN RAISE EXCEPTION 'Catalogue view does not show the references'; END IF;
 IF jsonb_array_length(c->'irish_retailers')<>(SELECT count(*) FROM colourfuel_catalog.retailer) THEN RAISE EXCEPTION 'Catalogue view does not show the retailers'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.buying_reference','INSERT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.retailer','INSERT') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('015_buying_references', jsonb_build_object('fixture_sha256',${q(sha(text))},'references',(SELECT count(*) FROM new_ref),'reviewed_on',${q(fixture.reviewed_on)},
 'retailers_added',(SELECT jsonb_agg(retailer_id ORDER BY ord) FROM new_shop),'previous_notes',(SELECT jsonb_object_agg(retailer_id,note) FROM old_note),
 'references_added',(SELECT jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,'retailer_id',retailer_id) ORDER BY ingredient_id) FROM new_ref)));
COMMIT;
`;
await writeFile(new URL('./015_buying_references.sql', import.meta.url), sql);
console.log(`Prepared 015 with ${refs.length} references and ${fixture.retailers.length} new retailers; SQL SHA-256 ${sha(sql)}`);
