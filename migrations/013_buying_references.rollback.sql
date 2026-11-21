-- Roll back 013: remove the SuperValu references it added and restore the previous SuperValu note.
BEGIN;
SELECT pg_advisory_xact_lock(721850220313);
CREATE TEMP TABLE added ON COMMIT DROP AS
 SELECT jsonb_array_elements_text(details->'ingredients') AS ingredient_id, (details->>'reviewed_on')::date AS reviewed_on, details->>'previous_supervalu_note' AS note
 FROM colourfuel.schema_migration WHERE migration_id='013_buying_references';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM added) THEN RAISE EXCEPTION '013 is not applied'; END IF; END $$;
DELETE FROM colourfuel_catalog.buying_reference b USING added a
 WHERE b.ingredient_id=a.ingredient_id AND b.retailer_id='supervalu' AND b.reviewed_on=a.reviewed_on;
UPDATE colourfuel_catalog.retailer SET payload=jsonb_set(payload,'{note}',to_jsonb((SELECT note FROM added LIMIT 1))) WHERE retailer_id='supervalu';
DELETE FROM colourfuel.schema_migration WHERE migration_id='013_buying_references';
COMMIT;
