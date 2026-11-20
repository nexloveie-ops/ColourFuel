-- 007: let the photo estimate add foods that are missing from the library.
-- The runtime account gets EXECUTE on one validated function only. It still cannot
-- INSERT/UPDATE/DELETE any table directly, and the function never changes existing foods.
-- Nutrient values must come from a USDA FoodData Central record or a printed pack label;
-- every added food records its source and is marked unreviewed.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='006_persistent_ingredient_catalog') THEN RAISE EXCEPTION 'Migration 006 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='007_photo_food_additions') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
 IF to_regrole('"colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam"') IS NULL THEN RAISE EXCEPTION 'Runtime role missing'; END IF;
END $$;

INSERT INTO colourfuel_catalog.dataset(dataset_id,payload) VALUES
 ('usda_fdc_photo_lookup', jsonb_build_object('dataset_id','usda_fdc_photo_lookup','publisher','U.S. Department of Agriculture, Agricultural Research Service','title','FoodData Central records looked up for foods seen in customer photos','url','https://fdc.nal.usda.gov/','license','Public domain (U.S. Government work)','country','United States','version','Live FoodData Central API; record and data type stored per food','sha256','Per-record lookups; see each food''s source_url')),
 ('photo_pack_label', jsonb_build_object('dataset_id','photo_pack_label','publisher','Product manufacturers (printed nutrition labels)','title','Nutrition labels read from packaging in customer photos','url','','license','Manufacturer nutrition declaration as printed on the pack','country','Product-specific market','version','Read from a photo at the time of addition; not checked against the manufacturer','sha256','Not applicable'));

CREATE TABLE colourfuel_catalog.photo_addition(
 variant_id text PRIMARY KEY REFERENCES colourfuel_catalog.variant,
 added_at timestamptz NOT NULL DEFAULT now(),
 source_type text NOT NULL CHECK(source_type IN ('usda_fdc','pack_label')),
 record_id text NOT NULL,
 seen_label text NOT NULL,
 payload jsonb NOT NULL);
REVOKE ALL ON colourfuel_catalog.photo_addition FROM PUBLIC;

CREATE FUNCTION colourfuel_catalog.add_photo_food(p jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE
 vid text := p->>'variant_id';
 iid text;
 src text := p->>'source_type';
 ds text;
 rec text := p->>'record_id';
 nm text := btrim(coalesce(p->>'name_en',''));
 cat text := p->>'category';
 st text := p->>'state';
 seen text := left(btrim(coalesce(p->>'seen_label','')),80);
 n jsonb; m record; given jsonb := '{}'::jsonb; v numeric; pos int := 0; ord int;
BEGIN
 -- Additions run one at a time (display order and duplicate checks stay consistent).
 PERFORM pg_advisory_xact_lock(721850220314);
 -- Same food already present (or added by a parallel request): nothing to change.
 IF vid IS NOT NULL AND EXISTS(SELECT 1 FROM colourfuel_catalog.variant WHERE variant_id=vid) THEN RETURN vid; END IF;
 IF vid IS NULL OR vid !~ '^[a-z0-9]+(-[a-z0-9]+)*--[a-z_]+$' OR length(vid)>80 THEN RAISE EXCEPTION 'Invalid variant id'; END IF;
 iid := split_part(vid,'--',1);
 IF split_part(vid,'--',2)<>st THEN RAISE EXCEPTION 'Variant id must end with the state'; END IF;
 IF length(nm) NOT BETWEEN 2 AND 60 OR nm ~ '[<>{}]' THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF cat NOT IN ('dairy','egg','fish','fruit','grain','herb','meat','nut','oil','pulse','sauce','seed','soy','spice','sweetener','vegetable','water') THEN RAISE EXCEPTION 'Invalid category'; END IF;
 IF st NOT IN ('raw','cooked','boiled','roasted','grilled','fried','baked','steamed','smoked','cured','dried','dry','toasted','pasteurised','unroasted','ready_to_eat','ready_to_use') THEN RAISE EXCEPTION 'Invalid state'; END IF;
 IF src='usda_fdc' THEN
  ds := 'usda_fdc_photo_lookup';
  IF rec !~ '^usda_fdc:[0-9]{3,9}$' THEN RAISE EXCEPTION 'Invalid USDA record'; END IF;
 ELSIF src='pack_label' THEN
  ds := 'photo_pack_label';
  IF rec !~ '^pack_label:[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid label record'; END IF;
 ELSE RAISE EXCEPTION 'Nutrition must come from USDA FoodData Central or a pack label'; END IF;
 -- Abuse guard: at most 50 automatic additions in any 24 hours.
 IF (SELECT count(*) FROM colourfuel_catalog.photo_addition WHERE added_at > now()-interval '24 hours') >= 50 THEN RAISE EXCEPTION 'Daily photo addition limit reached'; END IF;
 IF jsonb_typeof(p->'nutrients')<>'array' THEN RAISE EXCEPTION 'Nutrients required'; END IF;
 FOR n IN SELECT * FROM jsonb_array_elements(p->'nutrients') LOOP
  SELECT metric_id,unit INTO m FROM colourfuel_catalog.metric WHERE metric_id=n->>'metric_id';
  IF NOT FOUND OR m.unit<>n->>'unit' THEN RAISE EXCEPTION 'Unknown metric or unit: %',n->>'metric_id'; END IF;
  IF jsonb_typeof(n->'value')<>'number' THEN RAISE EXCEPTION 'Non-numeric value for %',m.metric_id; END IF;
  v := (n->>'value')::numeric;
  IF v<0 OR (m.unit='g' AND v>100) OR (m.unit='kcal' AND v>902) OR (m.unit='mg' AND v>100000) OR (m.unit='µg' AND v>1000000) THEN RAISE EXCEPTION 'Implausible value per 100 g for %',m.metric_id; END IF;
  given := given || jsonb_build_object(m.metric_id, jsonb_build_object('value',v,'qualifier',coalesce(n->>'qualifier','reported_numeric')));
 END LOOP;
 IF NOT (given ? 'energy_reported' AND given ? 'protein') THEN RAISE EXCEPTION 'Energy and protein are required'; END IF;

 INSERT INTO colourfuel_catalog.ingredient(ingredient_id,name_en,category) VALUES (iid,nm,cat) ON CONFLICT (ingredient_id) DO NOTHING;
 SELECT coalesce(max(display_order),0)+1 INTO ord FROM colourfuel_catalog.variant;
 INSERT INTO colourfuel_catalog.variant(variant_id,ingredient_id,state,name_en,record_id,dataset_id,source_basis,edible_description,has_reported_nutrients,display_order,metadata)
 VALUES (vid,iid,st,nm,rec,ds,'100g_food',left(coalesce(p->>'edible_description',nm),200),false,ord,
  jsonb_build_object('source_name',left(coalesce(p->>'source_name',''),160),'source_url',left(coalesce(p->>'source_url',''),300),'source_food_id',split_part(rec,':',2),
   'match_note','Added automatically from a customer photo estimate; not yet reviewed by ColourFuel.','verification_status','photo_added_unreviewed',
   'photo_addition',jsonb_build_object('source_type',src,'seen_label',seen,'added_at',now(),'review_status','unreviewed')));
 IF seen<>'' AND lower(seen)<>lower(nm) THEN INSERT INTO colourfuel_catalog.alias VALUES (vid,1,seen); END IF;
 FOR m IN SELECT metric_id,name_en,unit FROM colourfuel_catalog.metric ORDER BY display_order LOOP
  pos := pos+1;
  IF given ? m.metric_id THEN
   INSERT INTO colourfuel_catalog.observation VALUES (vid,m.metric_id,pos,m.unit,'primary_numeric',(given->m.metric_id->>'value')::numeric,NULL,
    jsonb_build_object('metric_en',m.name_en,'variant_id',vid,'primary_qualifier',given->m.metric_id->>'qualifier','primary_record_id',rec,'donor_record_id',NULL));
  ELSE
   INSERT INTO colourfuel_catalog.observation VALUES (vid,m.metric_id,pos,m.unit,'missing',NULL,NULL,
    jsonb_build_object('metric_en',m.name_en,'source_qualifier','missing','component_key',NULL));
  END IF;
 END LOOP;
 INSERT INTO colourfuel_catalog.photo VALUES (vid,'colourfuel-round.jpg',jsonb_build_object('variant_id',vid,'name_en',nm,'state',st,'width',1254,'height',1254,
  'title','No ingredient photo yet','artist','ColourFuel','license','ColourFuel logo placeholder','license_url','','source_url','','original_url','',
  'description','Placeholder: this food was added automatically from a customer photo estimate.','image_note','Placeholder logo, not a photograph of this food.','processing','None','placeholder',true));
 INSERT INTO colourfuel_catalog.photo_addition(variant_id,source_type,record_id,seen_label,payload) VALUES (vid,src,rec,seen,p);
 RETURN vid;
END $fn$;

REVOKE ALL ON FUNCTION colourfuel_catalog.add_photo_food(jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA colourfuel_catalog TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
GRANT EXECUTE ON FUNCTION colourfuel_catalog.add_photo_food(jsonb) TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";

-- Self-test inside a subtransaction that is always rolled back.
DO $$ DECLARE c jsonb; f jsonb; BEGIN
 BEGIN
  PERFORM colourfuel_catalog.add_photo_food('{"variant_id":"migration-selftest--cooked","name_en":"Migration self-test","category":"meat","state":"cooked","source_type":"usda_fdc","record_id":"usda_fdc:999999","seen_label":"test","nutrients":[{"metric_id":"energy_reported","unit":"kcal","value":100},{"metric_id":"protein","unit":"g","value":20}]}'::jsonb);
  SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
  SELECT x INTO f FROM jsonb_array_elements(c->'ingredients') x WHERE x->>'variant_id'='migration-selftest--cooked';
  IF f IS NULL OR f->>'verification_status'<>'photo_added_unreviewed' OR jsonb_array_length(f->'nutrients')<>(SELECT count(*) FROM colourfuel_catalog.metric) THEN RAISE EXCEPTION 'self-test payload invalid'; END IF;
  IF jsonb_array_length(c->'ingredient_photos')<>jsonb_array_length(c->'ingredients') THEN RAISE EXCEPTION 'self-test photo invariant failed'; END IF;
  RAISE EXCEPTION 'selftest_ok';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'selftest_ok' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM colourfuel_catalog.variant WHERE variant_id='migration-selftest--cooked') THEN RAISE EXCEPTION 'self-test left data behind'; END IF;
 IF NOT has_function_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.add_photo_food(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Runtime cannot execute add_photo_food'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.variant','INSERT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.observation','UPDATE') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.variant','DELETE') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
 IF NOT has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_web.catalog','SELECT') THEN RAISE EXCEPTION 'Runtime catalogue read lost'; END IF;
END $$;

INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('007_photo_food_additions',
 jsonb_build_object('function','colourfuel_catalog.add_photo_food(jsonb)','runtime_grant','EXECUTE only','datasets',jsonb_build_array('usda_fdc_photo_lookup','photo_pack_label'),'daily_limit',50,'variants_before',(SELECT count(*) FROM colourfuel_catalog.variant)));
COMMIT;
