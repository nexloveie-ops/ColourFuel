# Persistent ingredient catalogue migration

Status: imported and verified in Cloud SQL on 18 November 2026. Import operation `d471bdf0-6936-485e-bd70-000b00000024` completed `DONE` without error at `2026-11-18T21:42:56.477Z`. Application deployment follows the import.

The imported object is `gs://colourfuel-nutrition-import-721850220313/migrations/006-persistent-catalog-1d27e702-20261118.sql`; SQL SHA-256 is `b0dab229af4a186e7ab76d7ee113b4078ed6fbe5d572629ab01c07e602cf7690`. Live API verification matched all 3,661 source nutrient observations, all 114 database records, 114 photo records, 9 retailers and 120 buying references. Transactional SQL assertions checked table counts, unknown iodine, per-100-ml vinegar and unchanged runtime privileges before commit. The separate read-only verification script remains available for operators; it was not used as the evidence for this import.

Pre-import recovery checks: the existing Free Trial instance rejects manual backups (HTTP 400). SQL export to the existing private import bucket was rejected because the instance service account lacks bucket write permission (HTTP 412). No permissions were expanded. The migration is additive and transactional, preserves the original tables and exact catalogue view definition, and includes a non-destructive rollback; these are not a full database backup.

`006_persistent_catalog.sql` imports the public catalogue captured in `fixtures/persistent-catalog-source.json`. Source SHA-256 is `42d2bf93fc425adc56021be63cb60188c10dc3ca4013e69e7131da39967fb211`.

The transaction creates the `colourfuel_catalog` schema with separate ingredient, variant, alias, nutrient definition, nutrient observation, manufacturer observation, reference fill, dataset, photo, retailer, buying reference and migration receipt tables. It copies all 114 preparation records (112 ingredient types), 3,661 nutrient observations, 114 photo records and 120 buying references. Image files remain website assets; their identity, attribution, licence and paths are persisted in photo records. The 32 previous application records are preserved in the original normalized schema; this creates a unified catalogue that includes the 82 former file supplements.

The existing `colourfuel_web.catalog` SELECT permission is retained. A preserved legacy view supplies existing recipes and product data. The new projection reads ingredient/nutrient/retail/photo values from tables on every query. No database password, new user, IAM role, broader runtime grant, production order or released product is changed.

Before committing, SQL checks the database name, original record IDs, food states and existing numeric observations against the capture, counts, missing values, per-100-ml basis and runtime privileges. Any mismatch raises an exception and rolls back the transaction. A migration receipt prevents repeated execution from overwriting later database edits.

Local tests run the exact import on embedded PostgreSQL with only the database-name guard adapted from `colourfuel` to PGlite's `postgres`; the unmodified guard is tested to reject a wrong database. Tests compare every food/nutrient/source/reference/photo/retail field, change a database amount to verify that ranks change without file merging, verify read-only runtime access, reject source drift and execute rollback.

Execution order:

1. Confirm the existing Google Cloud project `project-4e0cb90b-8fb2-452b-9f0`, instance `colourfuel-dev-postgres`, database `colourfuel` and authenticated operator. Create a pre-migration backup using the existing project permissions.
2. Upload the exact reviewed SQL to the existing private import bucket `colourfuel-nutrition-import-721850220313` under a new migration-specific object name. Do not change bucket access or database grants.
3. Import the SQL into `colourfuel` using the established Cloud SQL import flow. Inspect its terminal success/failure result. A failed import must be investigated before retrying; never discard the guard.
4. Run `006_persistent_catalog.verify.sql`; verify counts 112 / 114 / 33 / 3661 / 114 / 120, zero file supplements, correct source hash, broccoli 89.2 mg and kiwi iodine NULL, rice vinegar per 100 ml, read permission true and insert permission false.
5. Deploy the persistence-only application branch after database verification. Its runtime has no import of the former ingredient data files. Browser photos and buying references hydrate from the same checked API snapshot as nutrients. Smoke checks reject a pre-migration database.
6. Verify the live API and browser, both nutrient estimate policies, Bowl customization and source/image/retail detail. Save the actual Cloud SQL import receipt and deployed revision.

Rollback: if the persistence-only application was deployed, restore the previous application revision first. Then execute `006_persistent_catalog.rollback.sql`. It restores the exact previous catalogue view definition, retaining all imported tables and audit data; it does not delete ingredient records. Do not rerun the import to recover after later edits.

Rebuild a reviewed import only from the captured fixture: `node migrations/build-persistent-catalog.mjs`. It verifies the source SHA-256 before generating SQL. Any future source change requires a new reviewed migration, not an edit to an applied migration.


# 007 photo food additions

Status: imported into Cloud SQL on 20 November 2026 as `postgres` (import operation `34787ded-316d-40cc-be1e-274d00000024`, DONE). Object `gs://colourfuel-nutrition-import-721850220313/migrations/007-photo-food-additions-030849e9-20261120.sql`, SHA-256 `030849e91fab1167a555da6cf93ec44217bbd9eeeb63438a8c40155cb7a59ff0`. A first attempt without `--user=postgres` failed with `permission denied for schema colourfuel_catalog` before any change and was rolled back.

Adds datasets `usda_fdc_photo_lookup` and `photo_pack_label`, the audit table `colourfuel_catalog.photo_addition`, and the SECURITY DEFINER function `colourfuel_catalog.add_photo_food(jsonb)`. The runtime IAM account gets `USAGE` on the schema and `EXECUTE` on that function only (user instruction, 20 November 2026); it still has no INSERT/UPDATE/DELETE on any table. The function inserts a new food only (an existing variant id is returned unchanged), requires a USDA FDC or pack-label record id, checks metric units and per-100 g bounds, requires energy and protein, stores every other metric as `missing`, writes a placeholder photo record (so the catalogue keeps one photo per food) and enforces 50 additions per 24 hours. Before commit the migration adds a test food inside a rolled-back subtransaction and checks the catalogue view, photo invariant and privileges.

Local tests: `photo-food-migration.test.mjs` runs 006 then 007 on embedded PostgreSQL and checks runtime-only access through the function, rejection of unsourced or implausible data, the daily limit, re-run guard and rollback. Rollback: `007_photo_food_additions.rollback.sql` revokes the grant and drops the function; foods already added remain (with source and unreviewed flag).


# 008 photo food images

Status: imported into Cloud SQL on 20 November 2026 as `postgres` (operation `309a6e5a-6bb2-4035-abb7-d65f00000024`, DONE). Object `gs://colourfuel-nutrition-import-721850220313/migrations/008-photo-food-images-48ce1fd8-20261120.sql`, SHA-256 `48ce1fd82985a9840442e6d037a50ce20731a5719ad8b77318162703cdcc223d`.

Adds `colourfuel_catalog.photo_image` (JPEG bytes, 1–400 KB) and two SECURITY DEFINER functions granted to the runtime account: `set_photo_food_image(text,jsonb,bytea)` replaces the `colourfuel-round.jpg` placeholder of a food listed in `photo_addition`, once, with a Wikimedia Commons file under CC0 / public domain / CC BY / CC BY-SA (artist, licence and file page required); `photo_image_bytes(text)` returns stored bytes for serving. The runtime account still has no direct table writes or reads of `photo_image`. Tested in `food-photos.test.mjs` on embedded PostgreSQL. Rollback (`008_photo_food_images.rollback.sql`) restores placeholders and drops both functions; stored image rows remain.


# 009 library expansion (400 foods)

Status: prepared and tested locally; not yet imported.

Adds 400 everyday foods sold in Ireland (batch `ireland-core-2026-11-20`). The reviewed list is `009-food-list.txt` (one line per food: variant id, English name, category, Chinese alias, exact source record). `prepare-009-library-expansion.mjs` reads the three already-registered public datasets (USDA SR Legacy 2018-04, USDA Foundation 2026-10, UK CoFID 2021), refuses any file whose SHA-256 differs from the registered one, and writes `fixtures/library-expansion-009.json` (+ `.sha256`). `build-009-library-expansion.mjs` turns the checked capture into `009_library_expansion.sql`.

Values are copied from one record per food: numbers stay numbers, CoFID `Tr` stays trace, everything else is missing. CoFID has no USDA-definition carbohydrate by difference, total dietary fibre or total sugars, so those three metrics stay missing for the 42 CoFID foods (same rule as the existing CoFID foods). CoFID 2021 reuses code 13-669 for two foods; reused codes are never accepted. New foods are `verification_status = source_matched`, `match_status = provisional`, with the ColourFuel placeholder photo until 010.

Before commit the SQL checks the capture (400 distinct new variants, registered datasets, one entry per metric in metric order, bounds), that existing ingredient types keep their category, that every existing observation is byte-for-byte unchanged (digest), that stored values equal the capture, the catalogue view and photo invariant, and that the runtime account is still read-only. Import as `postgres` with `gcloud sql import sql`. Tests: `library-expansion-migration.test.mjs` (006→009 on embedded PostgreSQL, rankings, search by Chinese alias, Bowl add-on rules, refusal of an existing food, exact rollback). Rollback: `009_library_expansion.rollback.sql` (refuses while 010 photos exist or a product uses a batch food).

# 010 library photos

Status: prepared locally; not yet imported.

336 openly licensed Wikimedia Commons photos (CC BY-SA 212, CC BY 64, CC0 36, public domain 24; artist and file page kept) for the 400 foods of 009, chosen by reviewing candidate thumbnails (English Wikipedia lead images and Commons search results), then checked again by file title and as a full contact sheet. 64 foods with no suitable open photo (wrong food, packaging/brand, live animal only) keep the ColourFuel placeholder. The manifest `fixtures/library-photos-010.json` (+ `.sha256`) records each file's attribution, thumbnail URL and SHA-256. `build-010-library-photos.mjs [image-cache-dir]` re-reads or re-downloads every image, refuses any byte difference, and writes `010_library_photos.sql` (not committed: it embeds the JPEG bytes). The SQL only replaces placeholders of 009 foods, stores bytes in `photo_image` (served by the existing `photo_image_bytes` function), and checks licence, source, size, hashes, the photo invariant and runtime privileges before commit. Rollback: `010_library_photos.rollback.sql`.

# Nutrient ranking query (application change shipped with 009)

`nutrient-ranking-query.mjs` was rewritten to expand each food's nutrient list once and aggregate each metric once, carrying only the fields it needs. On the 514-food catalogue in embedded PostgreSQL it takes 0.48 s instead of 6.9 s, and its output is byte-identical to the previous query on both the 114- and 514-food catalogues. Deploy it before importing 009.
