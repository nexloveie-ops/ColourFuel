BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF current_database()<>'colourfuel' OR NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='003_nutrient_reference_enrichment') THEN
  RAISE EXCEPTION 'Wrong database or missing nutrition migration';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS colourfuel_web;
REVOKE ALL ON SCHEMA colourfuel_web FROM PUBLIC;
CREATE TABLE IF NOT EXISTS colourfuel_web.ingredient_copy (
 variant_id text PRIMARY KEY REFERENCES colourfuel.ingredient_variant,
 name_en text NOT NULL, edible_description text NOT NULL, display_order integer NOT NULL
);
CREATE TABLE IF NOT EXISTS colourfuel_web.recipe_copy (
 recipe_id text PRIMARY KEY REFERENCES colourfuel.recipe,
 title_en text NOT NULL, category text NOT NULL, description text NOT NULL,
 steps jsonb NOT NULL CHECK(jsonb_typeof(steps)='array'), image text NOT NULL,
 colors jsonb NOT NULL CHECK(jsonb_typeof(colors)='array'), display_order integer NOT NULL,
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS colourfuel_web.metric_copy (
 metric_id text PRIMARY KEY REFERENCES colourfuel.nutrient_metric,
 name_en text NOT NULL, display_order integer NOT NULL
);
COMMENT ON SCHEMA colourfuel_web IS 'Public development catalogue projection and English editorial copy. Nutrition values remain in the normalized source tables.';

INSERT INTO colourfuel_web.ingredient_copy VALUES ('broccoli--raw','Broccoli','Edible florets and tender stems',0) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('carrot--raw','Carrot','Edible root',1) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('spinach--raw','Spinach','Edible leaves and tender stems',2) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('tomato--raw','Tomato','Ripe red tomatoes, year-round average',3) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('cucumber--raw','Cucumber','Flesh and skin',4) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('onion--raw','Onion','Edible bulb',5) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('garlic--raw','Garlic','Edible cloves',6) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('red-pepper--raw','Red sweet pepper','Edible red sweet pepper',7) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('potato--raw','Potato','Flesh and skin',8) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('sweet-potato--raw','Sweet potato','Raw, unprepared edible portion',9) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('apple--raw','Apple','Skin on, core removed before weighing',10) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('banana--raw','Banana','Flesh only',11) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('orange--raw','Orange','Edible flesh, peel removed',12) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('strawberry--raw','Strawberry','Edible fruit, stalks removed',13) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('blueberry--raw','Blueberry','Edible fruit',14) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('lentil--boiled','Lentils','Mature seeds, boiled without salt; cooked weight',15) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('chickpea--boiled','Chickpeas','Mature seeds, boiled without salt; cooked weight',16) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('kidney-bean--boiled','Kidney beans','Mature seeds, boiled without salt; cooked weight',17) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('oat--dry','Oats','Dry grain, not prepared porridge',18) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('brown-rice--cooked','Brown rice','Long-grain, cooked weight',19) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('quinoa--cooked','Quinoa','Cooked weight',20) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('egg--raw','Chicken egg','Whole edible egg, shell removed',21) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('chicken-breast--raw','Chicken breast','Skinless, boneless, no added solution',22) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('atlantic-salmon--raw','Atlantic salmon','Farmed; edible portion',23) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('whole-milk--pasteurised','Whole milk','Pasteurised whole milk; weighed in grams',24) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('plain-yogurt--ready_to_eat','Plain whole-milk yoghurt','Plain whole-milk yoghurt; weighed in grams',25) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('firm-tofu--raw','Firm tofu (calcium-set)','Firm tofu set with calcium sulphate',26) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('olive-oil--ready_to_use','Olive oil','Salad or cooking oil; weighed in grams',27) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('almond--unroasted','Almonds','Edible almond kernels, not apricot kernels',28) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.ingredient_copy VALUES ('chia--dried','Chia seeds','Dried seeds',29) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.recipe_copy(recipe_id,title_en,category,description,steps,image,colors,display_order) VALUES ('test-tomato-cucumber','Tomato & cucumber salad','Salads','Crisp cucumber, ripe tomatoes and a little olive oil.','["Wash the vegetables and weigh the edible portions.", "Chop the tomatoes and unpeeled cucumber. Toss with all the olive oil and divide evenly between two bowls."]'::jsonb,'salad-fresh.jpg','["green", "red"]'::jsonb,0) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.recipe_copy(recipe_id,title_en,category,description,steps,image,colors,display_order) VALUES ('test-chickpea-quinoa','Chickpea & quinoa bowl','Salads','A little crunch, a little comfort. A bowl that feels just right.','["Use cooked, unsalted chickpeas and cooked quinoa, weighed after cooking.", "Chop the washed tomatoes. Toss with the chickpeas, quinoa and olive oil, then divide evenly between two bowls."]'::jsonb,'salad-hero.jpg','["green", "gold"]'::jsonb,1) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.recipe_copy(recipe_id,title_en,category,description,steps,image,colors,display_order) VALUES ('test-yogurt-banana-chia','Banana & chia yoghurt bowl','Breakfast','Naturally sweet banana, creamy plain yoghurt and a little chia.','["Peel the banana and weigh the flesh only. Weigh the plain whole-milk yoghurt and dry chia seeds in grams.", "Stir the chia into the yoghurt and allow it to hydrate fully, then add the sliced banana."]'::jsonb,'yogurt.jpg','["gold"]'::jsonb,2) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.recipe_copy(recipe_id,title_en,category,description,steps,image,colors,display_order) VALUES ('test-apple-berry-almond','Apple, strawberry & almond bowl','Simple sides','Fresh fruit, a little crunch and a moment to yourself.','["Wash the apple, keep the skin and remove the core before weighing. Hull and weigh the strawberries.", "Chop the fruit, add the chopped almond kernels and divide evenly between two bowls."]'::jsonb,'yogurt.jpg','["red"]'::jsonb,3) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.recipe_copy(recipe_id,title_en,category,description,steps,image,colors,display_order) VALUES ('test-lentil-spinach','Lentil & spinach salad','Salads','Tender lentils, fresh spinach and tomatoes. Simply tossed together.','["Use cooked, unsalted lentils, weighed after cooking. Wash the spinach and tomatoes and weigh the edible portions.", "Chop the tomatoes, toss with the spinach, lentils and all the olive oil, then divide evenly between two bowls."]'::jsonb,'salad-glass.jpg','["green"]'::jsonb,4) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('energy_reported','Reported energy',0) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('protein','Protein',1) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('fat','Total fat',2) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('water','Water',3) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('saturated_fat','Saturated fatty acids',4) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('monounsaturated_fat','Monounsaturated fatty acids',5) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('polyunsaturated_fat','Polyunsaturated fatty acids',6) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('cholesterol','Cholesterol',7) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('calcium','Calcium',8) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('iron','Iron',9) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('magnesium','Magnesium',10) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('phosphorus','Phosphorus',11) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('potassium','Potassium',12) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('sodium','Sodium',13) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('zinc','Zinc',14) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('copper','Copper',15) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('manganese','Manganese',16) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('selenium','Selenium',17) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('iodine','Iodine',18) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('chloride','Chloride',19) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('biotin','Biotin',20) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('thiamin','Thiamin (B1)',21) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('riboflavin','Riboflavin (B2)',22) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('niacin','Niacin',23) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('pantothenic_acid','Pantothenic acid',24) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('vitamin_b6','Vitamin B6',25) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('vitamin_b12','Vitamin B12',26) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('vitamin_c','Vitamin C',27) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('vitamin_k1','Vitamin K1',28) ON CONFLICT DO NOTHING;
INSERT INTO colourfuel_web.metric_copy VALUES ('folate_total','Total folate (not DFE)',29) ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW colourfuel_web.ingredients AS
SELECT c.display_order, v.variant_id,
 jsonb_build_object(
 'ingredient_id',i.ingredient_id,'variant_id',v.variant_id,'name_en',c.name_en,
 'category',i.category,'state',v.food_state,'edible_description',c.edible_description,
 'status',i.status,'edible_fraction',v.edible_fraction,
 'aliases',coalesce((SELECT jsonb_agg(a.alias ORDER BY a.locale,a.alias) FROM colourfuel.ingredient_alias a WHERE a.ingredient_id=i.ingredient_id),'[]'::jsonb),
 'record_id',s.record_id,'source_name',s.name_original,'source_food_id',s.source_food_id,
 'dataset_id',s.dataset_id,'match_status',l.match_status,
 'nutrients',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'variant_id',v.variant_id,'metric_id',n.metric_id,'metric_en',mc.name_en,'unit',n.unit,
   'primary_record_id',n.anchor_record_id,'primary_qualifier',n.primary_qualifier,
   'primary_value',n.primary_value,'result',CASE n.value_kind WHEN 'trace' THEN 'trace_retained' ELSE n.value_kind END,
   'filled_value',CASE WHEN n.value_kind='reference_imputation' THEN n.value_per_100g END,
   'donor_record_id',n.donor_record_id
  ) ORDER BY mc.display_order)
  FROM colourfuel.ingredient_metric_resolved n JOIN colourfuel_web.metric_copy mc USING(metric_id)
  WHERE n.variant_id=v.variant_id),'[]'::jsonb),
 'reference_fills',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'metric_id',n.metric_id,'anchor_record_id',n.anchor_record_id,'donor_record_id',n.donor_record_id,
  'donor_component_key',n.donor_component_key,'donor_value',n.value_per_100g,'unit',n.unit,
  'food_match_note',n.food_match_note,'value_kind',n.value_kind,'evidence_url',n.evidence_url
 ) ORDER BY mc.display_order)
 FROM colourfuel.ingredient_metric_resolved n JOIN colourfuel_web.metric_copy mc USING(metric_id)
 WHERE n.variant_id=v.variant_id AND n.value_kind='reference_imputation'),'[]'::jsonb)
 ) AS payload
FROM colourfuel_web.ingredient_copy c JOIN colourfuel.ingredient_variant v USING(variant_id)
JOIN colourfuel.ingredient i USING(ingredient_id)
JOIN colourfuel.ingredient_source l ON l.variant_id=v.variant_id AND l.role='primary' AND l.match_status<>'rejected'
JOIN colourfuel_staging.food_source_record s ON s.record_id=l.record_id
 AND s.review_status NOT LIKE 'quarantined%' AND md5(s.payload::text)=l.source_payload_md5
 AND s.name_original=l.source_name_snapshot
WHERE i.status<>'retired';

CREATE OR REPLACE VIEW colourfuel_web.recipes AS
SELECT c.display_order,r.recipe_id,
 jsonb_build_object('recipe_id',r.recipe_id,'version',v.version,'title_en',c.title_en,
 'servings',v.servings,'minutes',v.preparation_minutes,'steps',c.steps,
 'image',c.image,'category',c.category,'colors',c.colors,'description',c.description,
 'status',v.status,'origin',r.origin,'nutrition_method',v.nutrition_method,
 'items',(SELECT jsonb_agg(jsonb_build_object(
  'line_no',ri.line_no,'variant_id',ri.variant_id,'record_id',ri.record_id,'edible_grams',ri.edible_grams,
  'name',ic.payload->>'name_en','state',ic.payload->>'state','edible_description',ic.payload->>'edible_description',
  'source_name',s.name_original,'source_food_id',s.source_food_id,'dataset_id',s.dataset_id,
  'source_url',CASE WHEN s.dataset_id LIKE 'usda%' THEN 'https://fdc.nal.usda.gov/food-details/'||s.source_food_id||'/nutrients'
                  ELSE d.metadata->>'license_source' END
 ) ORDER BY ri.line_no)
 FROM colourfuel.recipe_ingredient ri JOIN colourfuel_web.ingredients ic USING(variant_id)
 JOIN colourfuel_staging.food_source_record s ON s.record_id=ri.record_id AND md5(s.payload::text)=ri.source_payload_md5
 JOIN colourfuel_staging.dataset d USING(dataset_id)
 WHERE ri.recipe_id=r.recipe_id AND ri.version=v.version),
 'nutrition',(SELECT jsonb_agg(jsonb_build_object(
  'recipe_id',r.recipe_id,'metric_id',n.metric_id,'complete',n.is_complete,
  'total',n.total_amount,'per_serving',n.amount_per_serving,
  'reference_fill_items',n.reference_fill_items,'trace_items',n.trace_items,
  'unfilled_items',n.expected_items-n.numeric_items-n.trace_items
 ) ORDER BY mc.display_order)
 FROM colourfuel.recipe_metric_totals n JOIN colourfuel_web.metric_copy mc USING(metric_id)
 WHERE n.recipe_id=r.recipe_id AND n.version=v.version)
 ) AS payload
FROM colourfuel_web.recipe_copy c JOIN colourfuel.recipe r USING(recipe_id)
JOIN LATERAL (SELECT * FROM colourfuel.recipe_version rv WHERE rv.recipe_id=r.recipe_id AND rv.status<>'retired' ORDER BY rv.version DESC LIMIT 1) v ON true
WHERE c.enabled AND EXISTS(SELECT 1 FROM colourfuel.recipe_ingredient ri WHERE ri.recipe_id=r.recipe_id AND ri.version=v.version)
 AND NOT EXISTS(SELECT 1 FROM colourfuel.recipe_ingredient ri LEFT JOIN colourfuel_web.ingredients ic USING(variant_id)
  WHERE ri.recipe_id=r.recipe_id AND ri.version=v.version AND (ic.variant_id IS NULL OR ic.payload->>'record_id'<>ri.record_id));

CREATE OR REPLACE VIEW colourfuel_web.catalog AS
SELECT jsonb_build_object(
 'ingredients',(SELECT coalesce(jsonb_agg(payload ORDER BY display_order),'[]'::jsonb) FROM colourfuel_web.ingredients),
 'recipes',(SELECT coalesce(jsonb_agg(payload ORDER BY display_order),'[]'::jsonb) FROM colourfuel_web.recipes),
 'metrics',(SELECT jsonb_agg(jsonb_build_object('metric_id',m.metric_id,'name_en',c.name_en,'unit',m.unit,'interpretation',m.interpretation) ORDER BY c.display_order) FROM colourfuel.nutrient_metric m JOIN colourfuel_web.metric_copy c USING(metric_id)),
 'datasets',(SELECT jsonb_agg(metadata ORDER BY dataset_id) FROM colourfuel_staging.dataset),
 'snapshot_date',(SELECT max(metadata->>'retrieved_on') FROM colourfuel_staging.dataset),
 'data_mode','live','read_at',statement_timestamp()
) AS payload;
REVOKE ALL ON ALL TABLES IN SCHEMA colourfuel_web FROM PUBLIC;
GRANT CONNECT ON DATABASE colourfuel TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
GRANT USAGE ON SCHEMA colourfuel_web TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
GRANT SELECT ON colourfuel_web.catalog TO "colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam";
DO $$ BEGIN
 IF (SELECT count(*) FROM colourfuel_web.ingredients)<>30 OR (SELECT count(*) FROM colourfuel_web.recipes)<>5 THEN RAISE EXCEPTION 'Public catalogue count mismatch'; END IF;
 IF (SELECT payload->'recipes'->0->'nutrition'->0->>'metric_id' FROM colourfuel_web.catalog) IS NULL THEN RAISE EXCEPTION 'Missing nutrition'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('004_live_web_catalog','{"source":"normalized nutrition views","runtime_access":"SELECT colourfuel_web.catalog only","localisation":"en-IE"}') ON CONFLICT DO NOTHING;
COMMIT;
