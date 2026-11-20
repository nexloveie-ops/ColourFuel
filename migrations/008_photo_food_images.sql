-- 008: real photos for foods added from customer photos (migration 007).
-- Images are openly licensed Wikimedia Commons files stored in the database. The runtime
-- account may only (a) replace the ColourFuel placeholder of a photo-added food, once, and
-- (b) read stored image bytes to serve them. Every other photo stays untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='007_photo_food_additions') THEN RAISE EXCEPTION 'Migration 007 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='008_photo_food_images') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;

CREATE TABLE colourfuel_catalog.photo_image(
 image_path text PRIMARY KEY CHECK(image_path ~ '^ingredient-photo-[a-z0-9]+(-[a-z0-9]+)*--[a-z_]+\.jpg$'),
 variant_id text NOT NULL UNIQUE REFERENCES colourfuel_catalog.variant,
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1000 AND 400000),
 sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON colourfuel_catalog.photo_image FROM PUBLIC;

CREATE FUNCTION colourfuel_catalog.set_photo_food_image(vid text, info jsonb, img bytea) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE path text := 'ingredient-photo-'||vid||'.jpg'; lic text := info->>'license'; src text := info->>'source_url'; cur text;
BEGIN
 PERFORM pg_advisory_xact_lock(721850220315);
 IF NOT EXISTS(SELECT 1 FROM colourfuel_catalog.photo_addition WHERE variant_id=vid) THEN RAISE EXCEPTION 'Only foods added from photos can get an image here'; END IF;
 SELECT image_path INTO cur FROM colourfuel_catalog.photo WHERE variant_id=vid;
 IF cur IS DISTINCT FROM 'colourfuel-round.jpg' THEN RETURN cur; END IF; -- already has a real image: unchanged
 IF img IS NULL OR octet_length(img) NOT BETWEEN 1000 AND 400000 OR substring(img from 1 for 3)<>'\xffd8ff'::bytea THEN RAISE EXCEPTION 'Image must be a JPEG between 1 KB and 400 KB'; END IF;
 IF lic IS NULL OR lic !~* '^(CC0( 1\.0)?|Public domain|CC BY( [0-9.]+)?|CC BY-SA( [0-9.]+)?)$' THEN RAISE EXCEPTION 'Licence not accepted: %',lic; END IF;
 IF src IS NULL OR src !~ '^https://commons\.wikimedia\.org/wiki/File:' THEN RAISE EXCEPTION 'Source must be a Wikimedia Commons file page'; END IF;
 IF coalesce(btrim(info->>'artist'),'')='' OR (info->>'width')::int NOT BETWEEN 100 AND 2000 OR (info->>'height')::int NOT BETWEEN 100 AND 2000 THEN RAISE EXCEPTION 'Artist and image size required'; END IF;
 INSERT INTO colourfuel_catalog.photo_image(image_path,variant_id,bytes,sha256) VALUES (path,vid,img,encode(sha256(img),'hex'));
 UPDATE colourfuel_catalog.photo SET image_path=path, payload=(SELECT payload FROM colourfuel_catalog.photo WHERE variant_id=vid) - 'placeholder' || jsonb_build_object(
   'image',path,'width',(info->>'width')::int,'height',(info->>'height')::int,'title',left(coalesce(info->>'title',''),200),
   'artist',left(info->>'artist',200),'license',lic,'license_url',left(coalesce(info->>'license_url',''),300),'source_url',left(src,400),
   'original_url',left(coalesce(info->>'original_url',''),400),'description',left(coalesce(info->>'description',''),500),
   'image_note','Illustrative photo from Wikimedia Commons, chosen automatically for a food added from a customer photo; not a ColourFuel or supplier photograph.',
   'processing','Wikimedia Commons 720 px thumbnail, stored unchanged.')
  WHERE variant_id=vid;
 RETURN path;
END $fn$;

CREATE FUNCTION colourfuel_catalog.photo_image_bytes(path text) RETURNS bytea
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS
$fn$ SELECT bytes FROM colourfuel_catalog.photo_image WHERE image_path=path $fn$;

REVOKE ALL ON FUNCTION colourfuel_catalog.set_photo_food_image(text,jsonb,bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION colourfuel_catalog.photo_image_bytes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION colourfuel_catalog.set_photo_food_image(text,jsonb,bytea) TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
GRANT EXECUTE ON FUNCTION colourfuel_catalog.photo_image_bytes(text) TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";

DO $$ BEGIN
 IF NOT has_function_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.set_photo_food_image(text,jsonb,bytea)','EXECUTE') OR NOT has_function_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.photo_image_bytes(text)','EXECUTE') THEN RAISE EXCEPTION 'Runtime grants missing'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.photo','UPDATE') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.photo_image','INSERT') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
END $$;

INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('008_photo_food_images',
 jsonb_build_object('functions',jsonb_build_array('colourfuel_catalog.set_photo_food_image(text,jsonb,bytea)','colourfuel_catalog.photo_image_bytes(text)'),'runtime_grant','EXECUTE only','source','Wikimedia Commons (CC0, public domain, CC BY, CC BY-SA)'));
COMMIT;
