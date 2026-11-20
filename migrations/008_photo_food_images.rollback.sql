-- Rollback 008: restore the placeholder for photo-added foods and stop image writes/reads.
-- Stored image rows are kept for audit.
BEGIN;
DO $$ BEGIN IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
UPDATE colourfuel_catalog.photo p SET image_path='colourfuel-round.jpg', payload=p.payload || jsonb_build_object('image','colourfuel-round.jpg','width',1254,'height',1254,'title','No ingredient photo yet','artist','ColourFuel','license','ColourFuel logo placeholder','license_url','','source_url','','original_url','','placeholder',true)
 WHERE p.image_path LIKE 'ingredient-photo-%';
REVOKE EXECUTE ON FUNCTION colourfuel_catalog.set_photo_food_image(text,jsonb,bytea) FROM "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
REVOKE EXECUTE ON FUNCTION colourfuel_catalog.photo_image_bytes(text) FROM "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
DROP FUNCTION colourfuel_catalog.set_photo_food_image(text,jsonb,bytea);
DROP FUNCTION colourfuel_catalog.photo_image_bytes(text);
DELETE FROM colourfuel.schema_migration WHERE migration_id='008_photo_food_images';
COMMIT;
