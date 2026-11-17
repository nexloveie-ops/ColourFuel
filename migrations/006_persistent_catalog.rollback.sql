-- If the persistence-only application has been deployed, restore the previous application revision first.
-- Additive data tables and their audit receipt are retained; no ingredient data is deleted.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ DECLARE original_definition text; BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 SELECT legacy_view_definition INTO STRICT original_definition FROM colourfuel_catalog.migration_receipt WHERE migration_id='006_persistent_ingredient_catalog';
 EXECUTE 'CREATE OR REPLACE VIEW colourfuel_web.catalog AS '||original_definition;
END $$;
COMMIT;
