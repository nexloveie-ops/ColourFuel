-- Roll back 015: remove the references and retailers it added and restore the retailer notes it changed.
BEGIN;
SELECT pg_advisory_xact_lock(721850220313);
CREATE TEMP TABLE m ON COMMIT DROP AS SELECT details FROM colourfuel.schema_migration WHERE migration_id='015_buying_references';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM m) THEN RAISE EXCEPTION '015 is not applied'; END IF; END $$;
DELETE FROM colourfuel_catalog.buying_reference b USING m, jsonb_array_elements(m.details->'references_added') a
 WHERE b.ingredient_id=a->>'ingredient_id' AND b.retailer_id=a->>'retailer_id' AND b.reviewed_on=(m.details->>'reviewed_on')::date;
DELETE FROM colourfuel_catalog.retailer r USING m WHERE r.retailer_id IN (SELECT jsonb_array_elements_text(m.details->'retailers_added'));
UPDATE colourfuel_catalog.retailer r SET payload=jsonb_set(r.payload,'{note}',to_jsonb(n.value)) FROM m, jsonb_each_text(m.details->'previous_notes') n WHERE r.retailer_id=n.key;
DELETE FROM colourfuel.schema_migration WHERE migration_id='015_buying_references';
COMMIT;
