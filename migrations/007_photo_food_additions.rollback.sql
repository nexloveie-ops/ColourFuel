-- Rollback 007: stop automatic additions. Foods already added stay in the library
-- (with their source and unreviewed flag); remove them only by a separate reviewed change.
BEGIN;
DO $$ BEGIN IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
REVOKE EXECUTE ON FUNCTION colourfuel_catalog.add_photo_food(jsonb) FROM "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
REVOKE USAGE ON SCHEMA colourfuel_catalog FROM "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
DROP FUNCTION colourfuel_catalog.add_photo_food(jsonb);
DELETE FROM colourfuel.schema_migration WHERE migration_id='007_photo_food_additions';
COMMIT;
