-- Roll back 010: put the ColourFuel placeholder back on 009 foods and remove their stored Commons images.
BEGIN;
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='010_library_photos') THEN RAISE EXCEPTION '010 is not applied'; END IF; END $$;
CREATE TEMP TABLE batch_photo ON COMMIT DROP AS
 SELECT i.variant_id FROM colourfuel_catalog.photo_image i JOIN colourfuel_catalog.variant v USING(variant_id) WHERE v.metadata->>'library_batch'='ireland-core-2026-11-20';
UPDATE colourfuel_catalog.photo p SET image_path='colourfuel-round.jpg', payload=jsonb_build_object('variant_id',v.variant_id,'name_en',v.name_en,'state',v.state,'width',1254,'height',1254,
  'title','No ingredient photo yet','artist','ColourFuel','license','ColourFuel logo placeholder','license_url','','source_url','','original_url','',
  'description','Placeholder until an openly licensed photo is added.','image_note','Placeholder logo, not a photograph of this food.','processing','None','placeholder',true)
 FROM colourfuel_catalog.variant v WHERE v.variant_id=p.variant_id AND p.variant_id IN (SELECT variant_id FROM batch_photo);
DELETE FROM colourfuel_catalog.photo_image WHERE variant_id IN (SELECT variant_id FROM batch_photo);
DELETE FROM colourfuel.schema_migration WHERE migration_id='010_library_photos';
COMMIT;
