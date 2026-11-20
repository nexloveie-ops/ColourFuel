-- 009: add 400 everyday foods sold in Ireland to the ingredient library.
-- Every value is copied from one published record (USDA SR Legacy 2018-04, USDA Foundation 2026-10
-- or UK CoFID 2021, all already registered datasets). Missing values stay missing, CoFID trace stays
-- trace, and nothing existing is changed: only new variants (and new ingredient types) are added.
-- New foods get the ColourFuel placeholder photo until migration 010 adds Wikimedia Commons photos.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='300s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='008_photo_food_images') THEN RAISE EXCEPTION 'Migration 008 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='009_library_expansion') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;

CREATE TEMP TABLE expansion_input(payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO expansion_input VALUES (__CAPTURE_JSON__::jsonb);
CREATE TEMP TABLE expansion_food ON COMMIT DROP AS
 SELECT f, ord::integer AS ord FROM expansion_input CROSS JOIN LATERAL jsonb_array_elements(payload->'foods') WITH ORDINALITY x(f,ord);
CREATE TEMP TABLE expansion_before ON COMMIT DROP AS
 SELECT (SELECT count(*) FROM colourfuel_catalog.variant) AS variants, (SELECT count(*) FROM colourfuel_catalog.observation) AS observations,
  (SELECT count(*) FROM colourfuel_catalog.ingredient) AS ingredients, (SELECT coalesce(max(display_order),0) FROM colourfuel_catalog.variant) AS last_order,
  (SELECT md5(string_agg(variant_id||metric_id||result||coalesce(primary_value::text,'')||coalesce(filled_value::text,''),',' ORDER BY variant_id,metric_id)) FROM colourfuel_catalog.observation) AS observation_digest;

DO $$ DECLARE cnt int; BEGIN
 SELECT count(*) INTO cnt FROM expansion_food; IF cnt<>__FOOD_COUNT__ THEN RAISE EXCEPTION 'Capture should hold __FOOD_COUNT__ foods, found %',cnt; END IF;
 IF (SELECT count(DISTINCT f->>'variant_id') FROM expansion_food)<>cnt THEN RAISE EXCEPTION 'Duplicate variant in capture'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food e JOIN colourfuel_catalog.variant v ON v.variant_id=e.f->>'variant_id') THEN RAISE EXCEPTION 'A capture food is already in the library'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food e JOIN colourfuel_catalog.ingredient i ON i.ingredient_id=e.f->>'ingredient_id' WHERE i.category<>e.f->>'category') THEN RAISE EXCEPTION 'Category differs from the existing ingredient type'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food WHERE f->>'variant_id' !~ '^[a-z0-9]+(-[a-z0-9]+)*--[a-z_]+$' OR split_part(f->>'variant_id','--',1)<>f->>'ingredient_id' OR split_part(f->>'variant_id','--',2)<>f->>'state') THEN RAISE EXCEPTION 'Invalid variant id'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food WHERE f->>'category' NOT IN ('dairy','egg','fish','fruit','grain','herb','meat','nut','oil','pulse','sauce','seed','soy','spice','sweetener','vegetable','water')) THEN RAISE EXCEPTION 'Invalid category'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food WHERE f->>'state' NOT IN ('raw','cooked','boiled','roasted','grilled','fried','baked','smoked','dried','dry','toasted','pasteurised','ready_to_eat','ready_to_use')) THEN RAISE EXCEPTION 'Invalid state'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food WHERE f->>'dataset_id' NOT IN ('usda_sr_legacy_2018_04','usda_foundation_2026_10','uk_cofid_2021') OR NOT EXISTS(SELECT 1 FROM colourfuel_catalog.dataset d WHERE d.dataset_id=f->>'dataset_id')) THEN RAISE EXCEPTION 'Source dataset is not registered'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food WHERE jsonb_array_length(f->'nutrients')<>(SELECT count(*) FROM colourfuel_catalog.metric)) THEN RAISE EXCEPTION 'Every food needs one entry per metric'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food e CROSS JOIN LATERAL jsonb_array_elements(e.f->'nutrients') WITH ORDINALITY x(n,pos)
   LEFT JOIN colourfuel_catalog.metric m ON m.metric_id=n->>'metric_id'
   WHERE m.metric_id IS NULL OR m.unit<>n->>'unit' OR m.display_order<>pos OR n->>'result' NOT IN ('primary_numeric','trace_retained','missing')
    OR (n->>'result'='primary_numeric') <> (jsonb_typeof(n->'primary_value')='number')
    OR (n->>'result'<>'missing' AND n->>'primary_record_id' IS DISTINCT FROM e.f->>'record_id')
    OR (n->>'primary_value')::numeric<0 OR (m.unit='g' AND (n->>'primary_value')::numeric>100) OR (m.unit='kcal' AND (n->>'primary_value')::numeric>902)) THEN RAISE EXCEPTION 'Nutrient entry failed validation'; END IF;
 IF EXISTS(SELECT 1 FROM expansion_food e WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e.f->'nutrients') n WHERE n->>'metric_id'='energy_reported' AND n->>'result'<>'missing')) THEN RAISE EXCEPTION 'Energy is required'; END IF;
END $$;

INSERT INTO colourfuel_catalog.ingredient(ingredient_id,name_en,category)
 SELECT DISTINCT ON (f->>'ingredient_id') f->>'ingredient_id',f->>'name_en',f->>'category' FROM expansion_food ORDER BY f->>'ingredient_id',ord
 ON CONFLICT (ingredient_id) DO NOTHING;
INSERT INTO colourfuel_catalog.variant(variant_id,ingredient_id,state,name_en,record_id,dataset_id,source_basis,edible_description,has_reported_nutrients,display_order,metadata)
 SELECT f->>'variant_id',f->>'ingredient_id',f->>'state',f->>'name_en',f->>'record_id',f->>'dataset_id','100g_food',left(f->>'source_name',200),false,(SELECT last_order FROM expansion_before)+ord,
  jsonb_build_object('status','draft','match_status','provisional','source_name',f->>'source_name','source_food_id',f->>'source_food_id','source_url',f->>'source_url',
   'source_description',f->>'source_description','edible_fraction',NULL,'verification_status','source_matched',
   'match_note','Matched by name and preparation state to one published food record; not yet reviewed by ColourFuel.',
   'library_batch',(SELECT payload->>'batch' FROM expansion_input))
 FROM expansion_food;
INSERT INTO colourfuel_catalog.alias(variant_id,position,alias)
 SELECT f->>'variant_id',pos::integer,a FROM expansion_food CROSS JOIN LATERAL jsonb_array_elements_text(f->'aliases') WITH ORDINALITY x(a,pos);
INSERT INTO colourfuel_catalog.observation(variant_id,metric_id,position,unit,result,primary_value,filled_value,metadata)
 SELECT f->>'variant_id',n->>'metric_id',pos::integer,n->>'unit',n->>'result',(n->>'primary_value')::numeric,NULL,
  CASE WHEN n->>'result'='missing' THEN jsonb_build_object('metric_en',m.name_en,'source_qualifier',n->>'source_qualifier','component_key',NULL)
   ELSE jsonb_build_object('metric_en',m.name_en,'variant_id',f->>'variant_id','primary_qualifier',n->>'primary_qualifier','primary_record_id',n->>'primary_record_id','donor_record_id',NULL) END
 FROM expansion_food CROSS JOIN LATERAL jsonb_array_elements(f->'nutrients') WITH ORDINALITY x(n,pos) JOIN colourfuel_catalog.metric m ON m.metric_id=n->>'metric_id';
INSERT INTO colourfuel_catalog.photo(variant_id,image_path,payload)
 SELECT f->>'variant_id','colourfuel-round.jpg',jsonb_build_object('variant_id',f->>'variant_id','name_en',f->>'name_en','state',f->>'state','width',1254,'height',1254,
  'title','No ingredient photo yet','artist','ColourFuel','license','ColourFuel logo placeholder','license_url','','source_url','','original_url','',
  'description','Placeholder until an openly licensed photo is added.','image_note','Placeholder logo, not a photograph of this food.','processing','None','placeholder',true)
 FROM expansion_food;

DO $$ DECLARE b record; c jsonb; cnt int; BEGIN
 SELECT * INTO b FROM expansion_before; SELECT count(*) INTO cnt FROM expansion_food;
 IF (SELECT count(*) FROM colourfuel_catalog.variant)<>b.variants+cnt OR (SELECT count(*) FROM colourfuel_catalog.observation)<>b.observations+cnt*(SELECT count(*) FROM colourfuel_catalog.metric) THEN RAISE EXCEPTION 'Count check failed'; END IF;
 IF (SELECT md5(string_agg(variant_id||metric_id||result||coalesce(primary_value::text,'')||coalesce(filled_value::text,''),',' ORDER BY variant_id,metric_id)) FROM colourfuel_catalog.observation o
     WHERE NOT EXISTS(SELECT 1 FROM expansion_food e WHERE e.f->>'variant_id'=o.variant_id))<>b.observation_digest THEN RAISE EXCEPTION 'Existing nutrient values changed'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel_catalog.observation o JOIN expansion_food e ON e.f->>'variant_id'=o.variant_id JOIN LATERAL jsonb_array_elements(e.f->'nutrients') x ON x->>'metric_id'=o.metric_id
   WHERE o.primary_value IS DISTINCT FROM (x->>'primary_value')::numeric OR o.result<>x->>'result') THEN RAISE EXCEPTION 'Stored values differ from the capture'; END IF;
 SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
 IF jsonb_array_length(c->'ingredients')<>b.variants+cnt OR jsonb_array_length(c->'ingredient_photos')<>jsonb_array_length(c->'ingredients') THEN RAISE EXCEPTION 'Catalogue view check failed'; END IF;
 IF (SELECT x->>'record_id' FROM jsonb_array_elements(c->'ingredients') x WHERE x->>'variant_id'='back-rashers--grilled') IS DISTINCT FROM (SELECT f->>'record_id' FROM expansion_food WHERE f->>'variant_id'='back-rashers--grilled') THEN RAISE EXCEPTION 'Catalogue view does not show the new foods'; END IF;
 IF NOT has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_web.catalog','SELECT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.variant','INSERT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.observation','UPDATE') THEN RAISE EXCEPTION 'Runtime read-only privilege invariant failed'; END IF;
END $$;

INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('009_library_expansion',
 jsonb_build_object('batch',(SELECT payload->>'batch' FROM expansion_input),'capture_sha256','__CAPTURE_SHA256__','foods_added',(SELECT count(*) FROM expansion_food),
  'variants_before',(SELECT variants FROM expansion_before),'sources',(SELECT payload->'prepared_from' FROM expansion_input)));
COMMIT;
