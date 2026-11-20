-- Roll back 009: remove only the foods of batch ireland-core-2026-11-20 (and ingredient types that then have no foods).
-- Refuses to run if any of those foods is used by a product recipe, has a buying reference, or has a real photo image.
BEGIN;
SELECT pg_advisory_xact_lock(721850220313);
CREATE TEMP TABLE batch_variant ON COMMIT DROP AS SELECT variant_id, ingredient_id FROM colourfuel_catalog.variant WHERE metadata->>'library_batch'='ireland-core-2026-11-20';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='009_library_expansion') THEN RAISE EXCEPTION '009 is not applied'; END IF;
 IF to_regclass('colourfuel_catalog.photo_image') IS NOT NULL AND EXISTS(SELECT 1 FROM colourfuel_catalog.photo_image p JOIN batch_variant b USING(variant_id)) THEN RAISE EXCEPTION 'Roll back 010 (photos) first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel_catalog.legacy_catalog l, jsonb_path_query(l.payload,'strict $.**.variant_id') v JOIN batch_variant b ON b.variant_id=v#>>'{}') THEN RAISE EXCEPTION 'A batch food is used by a product'; END IF;
END $$;
DELETE FROM colourfuel_catalog.photo WHERE variant_id IN (SELECT variant_id FROM batch_variant);
DELETE FROM colourfuel_catalog.observation WHERE variant_id IN (SELECT variant_id FROM batch_variant);
DELETE FROM colourfuel_catalog.alias WHERE variant_id IN (SELECT variant_id FROM batch_variant);
DELETE FROM colourfuel_catalog.variant WHERE variant_id IN (SELECT variant_id FROM batch_variant);
DELETE FROM colourfuel_catalog.ingredient i WHERE i.ingredient_id IN (SELECT ingredient_id FROM batch_variant)
 AND NOT EXISTS(SELECT 1 FROM colourfuel_catalog.variant v WHERE v.ingredient_id=i.ingredient_id)
 AND NOT EXISTS(SELECT 1 FROM colourfuel_catalog.buying_reference r WHERE r.ingredient_id=i.ingredient_id);
DELETE FROM colourfuel.schema_migration WHERE migration_id='009_library_expansion';
COMMIT;
