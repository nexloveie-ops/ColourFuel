-- Roll back 011: put the ColourFuel placeholder back on the foods 011 pictured and remove their stored images.
BEGIN;
SELECT pg_advisory_xact_lock(721850220313);
CREATE TEMP TABLE pictured ON COMMIT DROP AS
 SELECT jsonb_array_elements_text(details->'variants') AS variant_id FROM colourfuel.schema_migration WHERE migration_id='011_library_photos';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pictured) THEN RAISE EXCEPTION '011 is not applied'; END IF; END $$;
UPDATE colourfuel_catalog.photo p SET image_path='colourfuel-round.jpg', payload=jsonb_build_object('variant_id',v.variant_id,'name_en',v.name_en,'state',v.state,'width',1254,'height',1254,
  'title','No ingredient photo yet','artist','ColourFuel','license','ColourFuel logo placeholder','license_url','','source_url','','original_url','',
  'description','Placeholder until an openly licensed photo is added.','image_note','Placeholder logo, not a photograph of this food.','processing','None','placeholder',true)
 FROM colourfuel_catalog.variant v WHERE v.variant_id=p.variant_id AND p.variant_id IN (SELECT variant_id FROM pictured);
DELETE FROM colourfuel_catalog.photo_image WHERE variant_id IN (SELECT variant_id FROM pictured);
DELETE FROM colourfuel.schema_migration WHERE migration_id='011_library_photos';
COMMIT;
