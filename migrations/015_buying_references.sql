-- 015: buying references from more Irish shops for 49 library ingredients that had none (fixture aecedfdc13692921b36a5378223f83c815f2aead9b1587998d215af0c4546089).
-- Adds retailers and reference rows and widens one retailer note; foods, nutrition, photos and existing references stay untouched.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(721850220313);
DO $$ BEGIN
 IF current_database()<>'colourfuel' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='013_buying_references') THEN RAISE EXCEPTION 'Migration 013 is required first'; END IF;
 IF EXISTS(SELECT 1 FROM colourfuel.schema_migration WHERE migration_id='015_buying_references') THEN RAISE EXCEPTION 'Migration already applied; nothing changed'; END IF;
END $$;
CREATE TEMP TABLE new_shop(ord integer PRIMARY KEY, retailer_id text NOT NULL UNIQUE, payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO new_shop VALUES
(1,'asia-market','{"id":"asia-market","url":"https://www.asiamarket.ie/","name":"Asia Market","note":"Dublin Asian supermarket with an online shop. Product listings for Asian vegetables, pulses, flours, seaweed and noodles (reviewed 21 November 2026). Check the site for delivery and availability."}'::jsonb),
(2,'evergreen','{"id":"evergreen","url":"https://evergreen.ie/","name":"Evergreen Healthfoods","note":"Galway health-food shop with an online shop. Product listings for pulses, grains, seeds, spices, oils and dried fruit (reviewed 21 November 2026). Check the site for delivery and availability."}'::jsonb),
(3,'fallon-byrne','{"id":"fallon-byrne","url":"https://www.fallonandbyrne.com/","name":"Fallon & Byrne","note":"Dublin food hall with an online shop. Product listings for saffron, rhubarb, clementines and tinned clams (reviewed 21 November 2026). Check the site for delivery and availability."}'::jsonb);
CREATE TEMP TABLE shop_note(retailer_id text PRIMARY KEY, note text NOT NULL) ON COMMIT DROP;
INSERT INTO shop_note VALUES
('village-butcher','Butcher with an online shop. Boneless pork loin for recipe development (reviewed 17 November 2026) and meat, offal and lobster listings for the wider library (reviewed 21 November 2026). Check the delivery area and availability.');
CREATE TEMP TABLE new_ref(ord integer PRIMARY KEY, ingredient_id text NOT NULL UNIQUE, retailer_id text NOT NULL, url text NOT NULL, product text NOT NULL, pack text NOT NULL, match_type text NOT NULL, note text NOT NULL) ON COMMIT DROP;
INSERT INTO new_ref VALUES
(1,'enoki-mushroom','asia-market','https://www.asiamarket.ie/products/enoki-mushroom-100g','Enoki Mushroom','100 g','ingredient',''),
(2,'kohlrabi','asia-market','https://www.asiamarket.ie/products/fresh-kohlrabi-1kg','Fresh Kohlrabi','1 kg','ingredient',''),
(3,'bamboo-shoots','asia-market','https://www.asiamarket.ie/products/golden-swan-bamboo-shoot-slices-227g','Golden Swan Bamboo Shoot Slices','227 g tin','ingredient',''),
(4,'water-chestnut','asia-market','https://www.asiamarket.ie/products/golden-swan-whole-water-chestnuts-227g','Golden Swan Whole Water Chestnuts','227 g tin','ingredient',''),
(5,'chinese-leaf','asia-market','https://www.asiamarket.ie/products/fresh-chinese-leaf-1pc','Fresh Chinese Leaf','1 head','ingredient',''),
(6,'wakame','asia-market','https://www.asiamarket.ie/products/well-pac-fueru-wakame-dried-seaweed-56-7g','Well Pac Fueru Wakame (dried seaweed)','56.7 g','prepare','Dried wakame; soak in water before use. The library food is raw wakame.'),
(7,'kelp','asia-market','https://www.asiamarket.ie/products/well-pac-dashi-kombu-dried-seaweed','Well Pac Dashi Kombu (dried kelp)','113.4 g','prepare','Dried kombu; soak or simmer before use. The library food is raw kelp.'),
(8,'onion-powder','asia-market','https://www.asiamarket.ie/products/eastend-onion-powder-100g','East End Onion Powder','100 g','ingredient',''),
(9,'split-pea','asia-market','https://www.asiamarket.ie/products/eastend-yellow-split-peas-500g','East End Yellow Split Peas','500 g','prepare','Dry split peas; boil before use. The library uses boiled split peas.'),
(10,'mung-bean','asia-market','https://www.asiamarket.ie/products/east-end-moong-whole-beans-mung-beans-500g','East End Moong Whole Beans (mung beans)','500 g','prepare','Dry mung beans; boil before use. The library uses boiled mung beans.'),
(11,'black-eyed-bean','asia-market','https://www.asiamarket.ie/products/east-end-black-eye-beans-in-salted-water-400g','East End Black Eye Beans in Salted Water','400 g tin','ingredient','Cooked beans in salted water; drain and rinse.'),
(12,'soba-noodles','asia-market','https://www.asiamarket.ie/products/hakubaku-organic-soba-noodle-270g','Hakubaku Organic Soba Noodle','270 g','prepare','Dry soba; boil before use. The library uses cooked soba.'),
(13,'rice-flour','asia-market','https://www.asiamarket.ie/products/flck-rice-flour-450g','FLCK Rice Flour','450 g','ingredient',''),
(14,'chickpea-flour','asia-market','https://www.asiamarket.ie/products/balah-gram-flour-1kg','Balah Gram Flour (Besan)','1 kg','ingredient',''),
(15,'ghee','asia-market','https://www.asiamarket.ie/products/ktc-butter-ghee-500g','KTC Butter Ghee','500 g','ingredient',''),
(16,'shiitake-mushroom','asia-market','https://www.asiamarket.ie/products/dried-shiitake-mushroom-1kg','Greatharvest Dried Shiitake Mushroom','1 kg','alternative','Dried shiitake; soak before use. The library food is fresh (raw) shiitake.'),
(17,'jackfruit','asia-market','https://www.asiamarket.ie/products/aroyd-jackfruit-in-syrup-565g','Aroy-D Jackfruit in Syrup','565 g tin','alternative','Ripe jackfruit tinned in sweet syrup; the library food is fresh raw jackfruit, and the syrup adds sugar.'),
(18,'macadamia','evergreen','https://evergreen.ie/products/true-natural-goodness-macadamia-nuts','True Natural Goodness Macadamia Nuts','100 g','ingredient',''),
(19,'miso','evergreen','https://evergreen.ie/products/clearspring-organic-japanese-brown-rice-miso-paste-pasteurised','Clearspring Organic Japanese Brown Rice Miso Paste (pasteurised)','300 g','ingredient',''),
(20,'carrageen-moss','evergreen','https://evergreen.ie/products/wild-irish-seaweed-organic-carrageen','Wild Irish Seaweed Organic Carrageen','40 g','prepare','Dried carrageen; soak before use. The library food is raw carrageen.'),
(21,'allspice','evergreen','https://evergreen.ie/products/sonnentor-organic-ground-allspice','Sonnentor Organic Ground Allspice','35 g','ingredient',''),
(22,'fenugreek','evergreen','https://evergreen.ie/products/sonnentor-organic-fenugreek-seeds','Sonnentor Organic Fenugreek Seeds','120 g','ingredient',''),
(23,'anise-seed','evergreen','https://evergreen.ie/products/sonnentor-organic-aniseed','Sonnentor Organic Aniseed','50 g','ingredient',''),
(24,'borlotti-bean','evergreen','https://evergreen.ie/products/biona-organic-borlotti-beans','Biona Organic Borlotti Beans','400 g','ingredient','Cooked beans in water; drain before use.'),
(25,'haricot-bean','evergreen','https://evergreen.ie/products/biona-organic-haricot-beans','Biona Organic Haricot Beans','400 g','ingredient','Cooked beans in water; drain before use.'),
(26,'soybean','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-soya-beans','True Natural Goodness Organic Soya Beans','500 g','prepare','Dry soya beans; soak overnight and boil. The library uses boiled soya beans.'),
(27,'spelt','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-spelt-grain','True Natural Goodness Organic Spelt Grain','500 g','prepare','Whole spelt grain; cook before use. The library uses cooked spelt.'),
(28,'amaranth','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-amaranth-1','True Natural Goodness Organic Amaranth','500 g','prepare','Dry amaranth grain; cook before use. The library uses cooked amaranth.'),
(29,'oat-bran','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-oatbran','True Natural Goodness Organic Oatbran','500 g','ingredient',''),
(30,'wheat-bran','evergreen','https://evergreen.ie/products/true-natural-goodness-wheatbran','True Natural Goodness Wheatbran','500 g','ingredient',''),
(31,'poppy-seed','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-poppy-seeds','True Natural Goodness Organic Poppy Seeds','250 g','ingredient',''),
(32,'avocado-oil','evergreen','https://evergreen.ie/products/clearspring-organic-avocado-oil','Clearspring Organic Avocado Oil','250 ml','ingredient',''),
(33,'walnut-oil','evergreen','https://evergreen.ie/products/emile-noel-organic-walnut-oil','Emile Noel Organic Walnut Oil','250 ml','ingredient',''),
(34,'flaxseed-oil','evergreen','https://evergreen.ie/products/biona-organic-flax-seed-oil','Biona Organic Flax Seed Oil','250 ml','ingredient',''),
(35,'dried-apple','evergreen','https://evergreen.ie/products/true-natural-goodness-apple-rings','True Natural Goodness Apple Rings','125 g','ingredient',''),
(36,'millet','evergreen','https://evergreen.ie/products/true-natural-goodness-organic-millet-grain','True Natural Goodness Organic Millet Grain','500 g','prepare','Dry millet grain; cook before use. The library uses cooked millet.'),
(37,'adzuki-bean','evergreen','https://evergreen.ie/products/biona-organic-aduki-beans','Biona Organic Aduki Beans','400 g','ingredient','Cooked beans in water; drain and rinse.'),
(38,'saffron','fallon-byrne','https://www.fallonandbyrne.com/shop/food-cupboard/salts-spices/don-gastronom-spanish-saffron-1g/','Don Gastronom Spanish Saffron','1 g','ingredient',''),
(39,'rhubarb','fallon-byrne','https://www.fallonandbyrne.com/shop/fruit-vegetables/vegetables/rhubarb-bunch12pc/','Rhubarb Bunch','1 bunch','ingredient',''),
(40,'clementine','fallon-byrne','https://www.fallonandbyrne.com/shop/fruit-vegetables/fruit/clementine/','Clementine','Sold individually','ingredient',''),
(41,'clams','fallon-byrne','https://www.fallonandbyrne.com/shop/food-cupboard/preserved-meat-fish/maruxaina-almejas-al-natural/','Maruxaina Almejas al Natural (white clams in brine)','120 g tin','alternative','Tinned white clams (Spisula solida) in brine; the library food is raw clams.'),
(42,'rabbit','village-butcher','https://thevillagebutcher.ie/product/farmed-rabbit/','Farmed Rabbit','Whole, 900 g–1.1 kg','ingredient','EU origin; the listing says it is occasionally frozen.'),
(43,'venison','village-butcher','https://thevillagebutcher.ie/product/venison-haunch-steaks/','Wild Irish Venison Haunch Steaks','300 g','ingredient',''),
(44,'beef-liver','village-butcher','https://thevillagebutcher.ie/product/beef-liver/','Beef Liver','500 g frozen pack','ingredient',''),
(45,'chicken-liver','village-butcher','https://thevillagebutcher.ie/product/free-range-chicken-liver/','Free Range Chicken Liver','500 g','ingredient',''),
(46,'gammon','village-butcher','https://thevillagebutcher.ie/product/full-gammon-on-the-bone-free-range/','Gammon With Bone – Free Range','Full or half joint','prepare','Raw gammon joint on the bone; boil before use. The library uses boiled gammon.'),
(47,'pork-shoulder','village-butcher','https://thevillagebutcher.ie/product/shoulder-of-pork/','Irish Pork Shoulder/Butt (plain)','1 kg / 2 kg','prepare','Raw boneless pork shoulder; choose the plain option and roast. The library uses roast pork shoulder.'),
(48,'stewed-beef','village-butcher','https://thevillagebutcher.ie/product/tender-diced-beef-pieces/','Tender Diced Beef Pieces','500 g / 1 kg','prepare','Raw diced brisket for stewing; the library uses cooked stewed beef.'),
(49,'lobster','village-butcher','https://thevillagebutcher.ie/product/lobster-tail-140-160g/','Lobster Tail 140/160 g','140–160 g','alternative','Frozen North Atlantic lobster tail only; cook before use. The library uses cooked lobster.');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM new_shop n JOIN colourfuel_catalog.retailer r USING(retailer_id)) THEN RAISE EXCEPTION 'Retailer already exists'; END IF;
 IF EXISTS(SELECT 1 FROM shop_note n LEFT JOIN colourfuel_catalog.retailer r USING(retailer_id) WHERE r.retailer_id IS NULL) THEN RAISE EXCEPTION 'Retailer to update is missing'; END IF;
 IF EXISTS(SELECT 1 FROM new_ref n LEFT JOIN colourfuel_catalog.ingredient i USING(ingredient_id) WHERE i.ingredient_id IS NULL) THEN RAISE EXCEPTION 'Reference for an unknown ingredient'; END IF;
 IF EXISTS(SELECT 1 FROM new_ref n JOIN colourfuel_catalog.buying_reference b USING(ingredient_id)) THEN RAISE EXCEPTION 'Ingredient already has a buying reference'; END IF;
END $$;
CREATE TEMP TABLE old_note ON COMMIT DROP AS SELECT r.retailer_id, r.payload->>'note' AS note FROM colourfuel_catalog.retailer r JOIN shop_note USING(retailer_id);
INSERT INTO colourfuel_catalog.retailer(retailer_id,display_order,payload)
 SELECT retailer_id,(SELECT max(display_order) FROM colourfuel_catalog.retailer)+ord,payload FROM new_shop;
UPDATE colourfuel_catalog.retailer r SET payload=jsonb_set(r.payload,'{note}',to_jsonb(n.note)) FROM shop_note n WHERE r.retailer_id=n.retailer_id;
INSERT INTO colourfuel_catalog.buying_reference(ingredient_id,retailer_id,url,product,pack,reviewed_on,evidence_type,match_type,note,display_order)
 SELECT ingredient_id,retailer_id,url,product,pack,'2026-11-21'::date,'product',match_type,note,(SELECT max(display_order) FROM colourfuel_catalog.buying_reference)+ord FROM new_ref;
DO $$ DECLARE c jsonb; BEGIN
 IF (SELECT count(*) FROM colourfuel_catalog.buying_reference b JOIN new_ref n USING(ingredient_id,retailer_id))<>(SELECT count(*) FROM new_ref) THEN RAISE EXCEPTION 'Reference insert count failed'; END IF;
 SELECT payload INTO STRICT c FROM colourfuel_web.catalog;
 IF jsonb_array_length(c->'irish_buying_references')<>(SELECT count(*) FROM colourfuel_catalog.buying_reference) THEN RAISE EXCEPTION 'Catalogue view does not show the references'; END IF;
 IF jsonb_array_length(c->'irish_retailers')<>(SELECT count(*) FROM colourfuel_catalog.retailer) THEN RAISE EXCEPTION 'Catalogue view does not show the retailers'; END IF;
 IF has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.buying_reference','INSERT') OR has_table_privilege('colourfuel-engine@project-4e0cb90b-8fb2-452b-9f0.iam','colourfuel_catalog.retailer','INSERT') THEN RAISE EXCEPTION 'Runtime must not write tables directly'; END IF;
END $$;
INSERT INTO colourfuel.schema_migration(migration_id,details) VALUES ('015_buying_references', jsonb_build_object('fixture_sha256','aecedfdc13692921b36a5378223f83c815f2aead9b1587998d215af0c4546089','references',(SELECT count(*) FROM new_ref),'reviewed_on','2026-11-21',
 'retailers_added',(SELECT jsonb_agg(retailer_id ORDER BY ord) FROM new_shop),'previous_notes',(SELECT jsonb_object_agg(retailer_id,note) FROM old_note),
 'references_added',(SELECT jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,'retailer_id',retailer_id) ORDER BY ingredient_id) FROM new_ref)));
COMMIT;
