BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF to_regclass('colourfuel_web.catalog') IS NULL THEN RAISE EXCEPTION 'Existing catalogue missing'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='006_persistent_ingredient_catalog') THEN RAISE EXCEPTION 'Migration already applied; no data overwritten'; END IF;
END $$;
CREATE TEMP TABLE migration_input(payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO migration_input VALUES (__SOURCE_JSON__::jsonb);
DO $$ DECLARE old jsonb; src jsonb; BEGIN
 SELECT payload INTO STRICT old FROM colourfuel_web.catalog;
 SELECT payload INTO STRICT src FROM migration_input;
 IF jsonb_array_length(src->'ingredients')<>114 OR jsonb_array_length(src->'metrics')<>33 OR jsonb_array_length(src->'photos')<>114 OR jsonb_array_length(src->'buying_references')<>120 THEN RAISE EXCEPTION 'Import manifest count mismatch'; END IF;
 IF jsonb_array_length(old->'ingredients')<>32 THEN RAISE EXCEPTION 'Unexpected legacy catalogue; recapture before migration'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(old->'ingredients') a LEFT JOIN jsonb_array_elements(src->'ingredients') b ON b->>'variant_id'=a->>'variant_id' WHERE b IS NULL OR a->>'record_id' IS DISTINCT FROM b->>'record_id' OR a->>'state' IS DISTINCT FROM b->>'state') THEN RAISE EXCEPTION 'Source food or state changed since capture'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(old->'ingredients') a CROSS JOIN LATERAL jsonb_array_elements(a->'nutrients') n LEFT JOIN jsonb_array_elements(src->'ingredients') b ON b->>'variant_id'=a->>'variant_id' LEFT JOIN LATERAL jsonb_array_elements(b->'nutrients') m ON m->>'metric_id'=n->>'metric_id' WHERE m IS NULL OR n->'primary_value' IS DISTINCT FROM m->'primary_value' OR coalesce(n->'filled_value','null'::jsonb) IS DISTINCT FROM coalesce(m->'filled_value','null'::jsonb) OR n->>'result' IS DISTINCT FROM m->>'result' OR n->>'unit' IS DISTINCT FROM m->>'unit') THEN RAISE EXCEPTION 'Nutrition changed since capture; no writes committed'; END IF;
END $$;
CREATE SCHEMA colourfuel_catalog;
REVOKE ALL ON SCHEMA colourfuel_catalog FROM PUBLIC;
CREATE TABLE colourfuel_catalog.migration_receipt(migration_id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),source_sha256 text NOT NULL,source_captured_at timestamptz NOT NULL,legacy_view_definition text NOT NULL,details jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.dataset(dataset_id text PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.ingredient(ingredient_id text PRIMARY KEY,name_en text NOT NULL,category text NOT NULL);
CREATE TABLE colourfuel_catalog.variant(variant_id text PRIMARY KEY,ingredient_id text NOT NULL REFERENCES colourfuel_catalog.ingredient,state text NOT NULL,name_en text NOT NULL,record_id text NOT NULL,dataset_id text NOT NULL REFERENCES colourfuel_catalog.dataset,source_basis text NOT NULL CHECK(source_basis IN ('100g_food','100ml_food')),edible_description text NOT NULL,has_reported_nutrients boolean NOT NULL,display_order integer NOT NULL UNIQUE,metadata jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.alias(variant_id text REFERENCES colourfuel_catalog.variant,position integer,alias text NOT NULL,PRIMARY KEY(variant_id,position));
CREATE INDEX ON colourfuel_catalog.alias(lower(alias));
CREATE TABLE colourfuel_catalog.metric(metric_id text PRIMARY KEY,name_en text NOT NULL,unit text NOT NULL,display_order integer NOT NULL UNIQUE,metadata jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.observation(variant_id text REFERENCES colourfuel_catalog.variant,metric_id text REFERENCES colourfuel_catalog.metric,position integer NOT NULL,unit text NOT NULL,result text NOT NULL,primary_value numeric CHECK(primary_value>=0),filled_value numeric CHECK(filled_value>=0),metadata jsonb NOT NULL,PRIMARY KEY(variant_id,metric_id),UNIQUE(variant_id,position),CHECK(primary_value IS NULL OR result='primary_numeric'),CHECK(filled_value IS NULL OR result='reference_imputation'));
CREATE TABLE colourfuel_catalog.reported_observation(variant_id text REFERENCES colourfuel_catalog.variant,metric_id text,position integer NOT NULL,unit text NOT NULL,value jsonb NOT NULL,metadata jsonb NOT NULL,PRIMARY KEY(variant_id,position));
CREATE TABLE colourfuel_catalog.reference_fill(variant_id text REFERENCES colourfuel_catalog.variant,metric_id text REFERENCES colourfuel_catalog.metric,position integer NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(variant_id,metric_id),UNIQUE(variant_id,position));
CREATE TABLE colourfuel_catalog.photo(variant_id text PRIMARY KEY REFERENCES colourfuel_catalog.variant,image_path text NOT NULL,payload jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.retailer(retailer_id text PRIMARY KEY,display_order integer NOT NULL UNIQUE,payload jsonb NOT NULL);
CREATE TABLE colourfuel_catalog.buying_reference(ingredient_id text REFERENCES colourfuel_catalog.ingredient,retailer_id text REFERENCES colourfuel_catalog.retailer,url text NOT NULL,product text NOT NULL,pack text NOT NULL,reviewed_on date NOT NULL,evidence_type text NOT NULL,match_type text NOT NULL,note text,display_order integer NOT NULL UNIQUE,PRIMARY KEY(ingredient_id,retailer_id,url));
INSERT INTO colourfuel_catalog.dataset SELECT d->>'dataset_id',d FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'datasets') d;
INSERT INTO colourfuel_catalog.ingredient SELECT DISTINCT ON (f->>'ingredient_id') f->>'ingredient_id',f->>'name_en',f->>'category' FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') f ORDER BY f->>'ingredient_id',f->>'variant_id';
INSERT INTO colourfuel_catalog.variant SELECT f->>'variant_id',f->>'ingredient_id',f->>'state',f->>'name_en',f->>'record_id',f->>'dataset_id',coalesce(f->>'source_basis','100g_food'),f->>'edible_description',f?'reported_nutrients',ord::integer,f-ARRAY['variant_id','ingredient_id','state','name_en','category','record_id','dataset_id','source_basis','edible_description','aliases','nutrients','reported_nutrients','reference_fills','local_supplement','database_record'] FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') WITH ORDINALITY a(f,ord);
INSERT INTO colourfuel_catalog.alias SELECT f->>'variant_id',ord::integer,a FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') f CROSS JOIN LATERAL jsonb_array_elements_text(f->'aliases') WITH ORDINALITY x(a,ord);
INSERT INTO colourfuel_catalog.metric SELECT m->>'metric_id',m->>'name_en',m->>'unit',ord::integer,m-ARRAY['metric_id','name_en','unit'] FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'metrics') WITH ORDINALITY x(m,ord);
INSERT INTO colourfuel_catalog.observation SELECT f->>'variant_id',n->>'metric_id',ord::integer,n->>'unit',n->>'result',(n->>'primary_value')::numeric,(n->>'filled_value')::numeric,n-ARRAY['metric_id','unit','result','primary_value','filled_value'] FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') f CROSS JOIN LATERAL jsonb_array_elements(f->'nutrients') WITH ORDINALITY x(n,ord);
INSERT INTO colourfuel_catalog.reported_observation SELECT f->>'variant_id',n->>'metric_id',ord::integer,n->>'unit',coalesce(n->'value','null'::jsonb),n-ARRAY['metric_id','unit','value'] FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') f CROSS JOIN LATERAL jsonb_array_elements(f->'reported_nutrients') WITH ORDINALITY x(n,ord);
INSERT INTO colourfuel_catalog.reference_fill SELECT f->>'variant_id',n->>'metric_id',ord::integer,n FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'ingredients') f CROSS JOIN LATERAL jsonb_array_elements(f->'reference_fills') WITH ORDINALITY x(n,ord);
INSERT INTO colourfuel_catalog.photo SELECT p->>'variant_id',p->>'image',p FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'photos') p;
INSERT INTO colourfuel_catalog.retailer SELECT p->>'id',ord::integer,p FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'retailers') WITH ORDINALITY x(p,ord);
INSERT INTO colourfuel_catalog.buying_reference SELECT p->>'ingredient_id',p->>'retailer_id',p->>'url',p->>'product',p->>'pack',(p->>'reviewed_on')::date,p->>'evidence_type',p->>'match',p->>'note',ord::integer FROM migration_input CROSS JOIN LATERAL jsonb_array_elements(payload->'buying_references') WITH ORDINALITY x(p,ord);
INSERT INTO colourfuel_catalog.migration_receipt SELECT '006_persistent_ingredient_catalog',now(),'__SOURCE_SHA256__',(payload->>'captured_at')::timestamptz,pg_get_viewdef('colourfuel_web.catalog'::regclass,true),jsonb_build_object('ingredients',112,'variants',114,'metrics',33,'observations',3661,'photos',114,'buying_references',120,'previous_database_variants',32,'previous_supplements',82) FROM migration_input;
DO $$ BEGIN EXECUTE 'CREATE VIEW colourfuel_catalog.legacy_catalog AS '||pg_get_viewdef('colourfuel_web.catalog'::regclass,true); END $$;
CREATE VIEW colourfuel_catalog.variant_payload AS
SELECT v.display_order,v.variant_id,(v.metadata||jsonb_build_object('variant_id',v.variant_id,'ingredient_id',v.ingredient_id,'state',v.state,'name_en',v.name_en,'category',i.category,'record_id',v.record_id,'dataset_id',v.dataset_id,'source_basis',v.source_basis,'edible_description',v.edible_description,'database_record',true,'local_supplement',false,
 'aliases',coalesce((SELECT jsonb_agg(a.alias ORDER BY a.position) FROM colourfuel_catalog.alias a WHERE a.variant_id=v.variant_id),'[]'::jsonb),
 'nutrients',coalesce((SELECT jsonb_agg(o.metadata||jsonb_build_object('metric_id',o.metric_id,'unit',o.unit,'result',o.result,'primary_value',o.primary_value,'filled_value',o.filled_value) ORDER BY o.position) FROM colourfuel_catalog.observation o WHERE o.variant_id=v.variant_id),'[]'::jsonb),
 'reported_nutrients',coalesce((SELECT jsonb_agg(o.metadata||jsonb_build_object('unit',o.unit,'value',o.value)||CASE WHEN o.metric_id IS NOT NULL THEN jsonb_build_object('metric_id',o.metric_id) ELSE '{}'::jsonb END ORDER BY o.position) FROM colourfuel_catalog.reported_observation o WHERE o.variant_id=v.variant_id),'[]'::jsonb),
 'reference_fills',coalesce((SELECT jsonb_agg(o.payload ORDER BY o.position) FROM colourfuel_catalog.reference_fill o WHERE o.variant_id=v.variant_id),'[]'::jsonb))) - CASE WHEN v.has_reported_nutrients THEN ARRAY[]::text[] ELSE ARRAY['reported_nutrients'] END AS payload
FROM colourfuel_catalog.variant v JOIN colourfuel_catalog.ingredient i USING(ingredient_id);
CREATE OR REPLACE VIEW colourfuel_web.catalog AS
SELECT (legacy.payload-ARRAY['ingredients','metrics','datasets'])||jsonb_build_object(
 'ingredients',(SELECT jsonb_agg(payload ORDER BY display_order) FROM colourfuel_catalog.variant_payload),
 'metrics',(SELECT jsonb_agg(metadata||jsonb_build_object('metric_id',metric_id,'name_en',name_en,'unit',unit) ORDER BY display_order) FROM colourfuel_catalog.metric),
 'datasets',(SELECT jsonb_agg(payload ORDER BY dataset_id) FROM colourfuel_catalog.dataset),
 'ingredient_photos',(SELECT jsonb_agg(payload||jsonb_build_object('image',image_path) ORDER BY variant_id) FROM colourfuel_catalog.photo),
 'irish_retailers',(SELECT jsonb_agg(payload ORDER BY display_order) FROM colourfuel_catalog.retailer),
 'irish_buying_references',(SELECT jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,'retailer_id',retailer_id,'url',url,'product',product,'pack',pack,'reviewed_on',reviewed_on::text,'evidence_type',evidence_type,'match',match_type,'note',note) ORDER BY display_order) FROM colourfuel_catalog.buying_reference),
 'local_supplement_count',0,'persistent_ingredient_count',(SELECT count(*) FROM colourfuel_catalog.variant),
 'catalog_persistence',jsonb_build_object('migration_id','006_persistent_ingredient_catalog','storage','cloud-sql-tables','source_sha256',(SELECT source_sha256 FROM colourfuel_catalog.migration_receipt WHERE migration_id='006_persistent_ingredient_catalog')),'read_at',statement_timestamp()) AS payload
FROM colourfuel_catalog.legacy_catalog legacy;
REVOKE ALL ON ALL TABLES IN SCHEMA colourfuel_catalog FROM PUBLIC;
DO $$ DECLARE actual jsonb; src jsonb; BEGIN
 SELECT payload INTO STRICT actual FROM colourfuel_web.catalog; SELECT payload INTO STRICT src FROM migration_input;
 IF (SELECT count(*) FROM colourfuel_catalog.ingredient)<>112 OR (SELECT count(*) FROM colourfuel_catalog.variant)<>114 OR (SELECT count(*) FROM colourfuel_catalog.observation)<>3661 OR (SELECT count(*) FROM colourfuel_catalog.photo)<>114 OR (SELECT count(*) FROM colourfuel_catalog.buying_reference)<>120 THEN RAISE EXCEPTION 'Persistent catalogue count validation failed'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel_catalog.variant_payload a JOIN jsonb_array_elements(src->'ingredients') b ON b->>'variant_id'=a.variant_id WHERE a.payload->>'record_id' IS DISTINCT FROM b->>'record_id' OR a.payload->>'state' IS DISTINCT FROM b->>'state' OR a.payload->'reference_fills' IS DISTINCT FROM b->'reference_fills') THEN RAISE EXCEPTION 'Food state/source/reference mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel_catalog.observation o JOIN jsonb_array_elements(src->'ingredients') f ON f->>'variant_id'=o.variant_id JOIN LATERAL jsonb_array_elements(f->'nutrients') n ON n->>'metric_id'=o.metric_id WHERE o.primary_value IS DISTINCT FROM (n->>'primary_value')::numeric OR o.filled_value IS DISTINCT FROM (n->>'filled_value')::numeric OR o.unit IS DISTINCT FROM n->>'unit' OR o.result IS DISTINCT FROM n->>'result') THEN RAISE EXCEPTION 'Nutrient field comparison failed'; END IF;
 IF (SELECT primary_value FROM colourfuel_catalog.observation WHERE variant_id='broccoli--raw' AND metric_id='vitamin_c')<>89.2 OR (SELECT source_basis FROM colourfuel_catalog.variant WHERE variant_id='rice-vinegar--ready_to_use')<>'100ml_food' THEN RAISE EXCEPTION 'Nutrient or volume basis validation failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel_catalog.observation WHERE variant_id='kiwi--raw' AND metric_id='iodine' AND primary_value IS NULL AND filled_value IS NULL AND result='missing') THEN RAISE EXCEPTION 'Missing nutrient must remain unknown'; END IF;
 IF NOT has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_web.catalog','SELECT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.variant','INSERT') THEN RAISE EXCEPTION 'Runtime read-only privilege invariant failed'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) SELECT migration_id,details||jsonb_build_object('source_sha256',source_sha256) FROM colourfuel_catalog.migration_receipt;
COMMIT;
