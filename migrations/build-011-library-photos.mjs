// Build 011 (more Wikimedia Commons photos for 009 foods that still show the placeholder after 010).
// Usage: node migrations/build-011-library-photos.mjs [image-cache-dir]
// Each image is read from the cache dir (<variant_id>.jpg) or downloaded again from its Commons thumbnail URL,
// and must match the SHA-256 in the manifest. The generated SQL (~2× image bytes) is not committed.
import { readFile, writeFile } from 'node:fs/promises'; import { createHash } from 'node:crypto';
const sha = b => createHash('sha256').update(b).digest('hex');
const UA = 'ColourFuelIngredientPhotos/1.0 (https://www.colourfuel.ie)';
const LICENCE = /^(CC0( 1\.0)?|Public domain|CC BY( [0-9.]+)?|CC BY-SA( [0-9.]+)?)$/i;
const manifestText = await readFile(new URL('../fixtures/library-photos-011.json', import.meta.url), 'utf8');
if (sha(manifestText) !== (await readFile(new URL('../fixtures/library-photos-011.sha256', import.meta.url), 'utf8')).trim()) throw Error('Manifest checksum mismatch');
const manifest = JSON.parse(manifestText);
const capture = JSON.parse(await readFile(new URL('../fixtures/library-expansion-009.json', import.meta.url), 'utf8'));
const batch = new Set(capture.foods.map(f => f.variant_id));
const cache = process.argv[2];
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const rows = [];
for (const p of manifest.photos) {
  if (!batch.has(p.variant_id)) throw Error(`${p.variant_id} is not a 009 food`);
  if (!LICENCE.test(p.license) || !p.artist || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.source_url)) throw Error(`${p.variant_id}: licence, artist or source missing`);
  let bytes = null;
  if (cache) try { bytes = await readFile(`${cache}/${p.variant_id}.jpg`); } catch {}
  if (!bytes) { const r = await fetch(p.thumb_url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw Error(`${p.variant_id}: download ${r.status}`); bytes = Buffer.from(await r.arrayBuffer()); }
  if (sha(bytes) !== p.sha256) throw Error(`${p.variant_id}: image differs from the manifest`);
  if (bytes.length < 1000 || bytes.length > 400000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error(`${p.variant_id}: not a usable JPEG`);
  const info = { title: p.title, artist: p.artist, license: p.license, license_url: p.license_url, source_url: p.source_url, original_url: p.original_url, description: p.description || '', width: p.width, height: p.height };
  rows.push(`(${q(p.variant_id)},${q(JSON.stringify(info))}::jsonb,'\\x${bytes.toString('hex')}'::bytea,${q(p.sha256)})`);
}
const sql = `-- 011: more openly licensed Wikimedia Commons photos for 009 foods still showing the placeholder (manifest ${sha(manifestText)}).
-- Replaces only the ColourFuel placeholder of 009 foods; every other photo stays untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='600s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='010_library_photos') THEN RAISE EXCEPTION 'Migration 010 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='011_library_photos') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;
CREATE TEMP TABLE new_photo(variant_id text PRIMARY KEY, info jsonb NOT NULL, bytes bytea NOT NULL, sha256 text NOT NULL) ON COMMIT DROP;
INSERT INTO new_photo VALUES
${rows.join(',\n')};
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM new_photo n LEFT JOIN colourfuel_catalog.variant v USING(variant_id) WHERE v.metadata->>'library_batch' IS DISTINCT FROM ${q(capture.batch)}) THEN RAISE EXCEPTION 'Photo for a food outside the 009 batch'; END IF;
 IF EXISTS(SELECT 1 FROM new_photo n JOIN colourfuel_catalog.photo p USING(variant_id) WHERE p.image_path<>'colourfuel-round.jpg') THEN RAISE EXCEPTION 'Food already has a real photo'; END IF;
 IF EXISTS(SELECT 1 FROM new_photo WHERE encode(sha256(bytes),'hex')<>sha256 OR substring(bytes from 1 for 3)<>'\\xffd8ff'::bytea) THEN RAISE EXCEPTION 'Image bytes failed validation'; END IF;
 IF EXISTS(SELECT 1 FROM new_photo WHERE info->>'license' !~* '^(CC0( 1\\.0)?|Public domain|CC BY( [0-9.]+)?|CC BY-SA( [0-9.]+)?)$' OR info->>'source_url' !~ '^https://commons\\.wikimedia\\.org/wiki/File:' OR coalesce(btrim(info->>'artist'),'')='' OR (info->>'width')::int NOT BETWEEN 100 AND 2000 OR (info->>'height')::int NOT BETWEEN 100 AND 2000) THEN RAISE EXCEPTION 'Licence, source, artist or size failed validation'; END IF;
END $$;
INSERT INTO colourfuel_catalog.photo_image(image_path,variant_id,bytes,sha256) SELECT 'ingredient-photo-'||variant_id||'.jpg',variant_id,bytes,sha256 FROM new_photo;
UPDATE colourfuel_catalog.photo p SET image_path='ingredient-photo-'||n.variant_id||'.jpg', payload=p.payload - 'placeholder' || jsonb_build_object(
  'image','ingredient-photo-'||n.variant_id||'.jpg','width',(n.info->>'width')::int,'height',(n.info->>'height')::int,'title',left(n.info->>'title',200),
  'artist',left(n.info->>'artist',200),'license',n.info->>'license','license_url',left(coalesce(n.info->>'license_url',''),300),'source_url',left(n.info->>'source_url',400),
  'original_url',left(coalesce(n.info->>'original_url',''),400),'description',left(coalesce(n.info->>'description',''),500),
  'image_note','Illustrative photo from Wikimedia Commons, chosen for the ColourFuel ingredient library; not a ColourFuel or supplier photograph.',
  'processing','Wikimedia Commons thumbnail, stored unchanged.')
 FROM new_photo n WHERE p.variant_id=n.variant_id AND p.image_path='colourfuel-round.jpg';
DO $$ DECLARE c jsonb; BEGIN
 IF (SELECT count(*) FROM colourfuel_catalog.photo p JOIN new_photo n USING(variant_id) WHERE p.image_path='ingredient-photo-'||n.variant_id||'.jpg')<>(SELECT count(*) FROM new_photo) THEN RAISE EXCEPTION 'Photo update count failed'; END IF;
 SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
 IF jsonb_array_length(c->'ingredient_photos')<>jsonb_array_length(c->'ingredients') THEN RAISE EXCEPTION 'Photo invariant failed'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.photo','UPDATE') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.photo_image','INSERT') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('011_library_photos', jsonb_build_object('manifest_sha256',${q(sha(manifestText))},'photos',(SELECT count(*) FROM new_photo),'batch',${q(capture.batch)},'variants',(SELECT jsonb_agg(variant_id ORDER BY variant_id) FROM new_photo)));
COMMIT;
`;
const out = new URL('./011_library_photos.sql', import.meta.url);
await writeFile(out, sql);
console.log(`Prepared 011 with ${rows.length} photos; SQL SHA-256 ${sha(sql)} (${(sql.length / 1e6).toFixed(1)} MB)`);
