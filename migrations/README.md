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
