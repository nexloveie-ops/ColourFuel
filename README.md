# ColourFuel

Start here for product intent: [Requirements handoff](design/requirements-handoff.md) · [Claude instructions](CLAUDE.md).

ColourFuel's Ireland-market Bowl concept website combines a visual menu, source-linked ingredient information, editable recipes and Nutrition Passports. The production Node server reads the existing Cloud SQL catalogue; it exposes no database-write or ordering endpoints.

## Current website

- Eight Bowl concepts with requested target prices; Crispy Pork and Signature Salmon are R&D and unavailable to order. No Wrap products.
- Shared v2 standard portions with draggable sliders, gram/nutrition feedback, Protein+ and Active Day test presets, and one required sauce with recommended pairings and alternatives. Customer Bowl pages omit redundant recipe-name and batch inputs; the separate recipe workspace retains them.
- Explicitly invented demo add-on charges update the per-bowl price and breakdown; batch totals are available in the recipe workspace. Real unit costs and commercial prices remain unverified. Kitchen prep sheets and Passport reports include portion/weight details.
- Searchable ingredient library with 114 photo-backed preparation records (112 ingredient types), source provenance, neutral nutrition context and adult reference comparisons.
- Nutrient-first browsing for all 33 tracked definitions, descending per-100-g lists, per-ingredient relative ranks and an estimate-inclusion switch. Rankings use only comparable numerical records in this library, with ties, source coverage and raw/cooked states explicit.
- Irish buying references for all 114 preparation records (112 ingredient types): 119 product references and one Lidl chicken-range reference, with retailer filtering, pack sizes, review dates and explicit preparation/brand differences. M&S and Donnybrook Fair have separately labelled store-enquiry links.
- Recipe browsing, browser-local saved recipes/version history, sharing and Nutrition Passport download/print.
- White canvas with yellow, blue, purple and cherry red accents. Vegan-base and vegetarian-concept badges distinguish suitable base recipes; sauces, additions and vegetarian-suitable feta need their own checks.

Menu prices are unvalidated targets, not quotes. Finished portions, cooking yield, kitchen feasibility, allergens and cross-contact remain under review. Sauce formulations are not quantified; the editor and Passport show clearly labelled base-only estimates. Full-Bowl totals remain unknown, never zero-filled. No stock availability or orderability is invented.

## Run and test

Use Node 22. Run `npm ci --ignore-scripts`, `npm run check` and `npm test`. `npm start` serves the real app and requires the existing database configuration described in `db.mjs` and `cloudbuild.yaml`. Database credentials are never served to browsers.

`previews/colourfuel-bowl/` is a historical snapshot, not the current frontend development entry point. Work in the repository root. Without cloud credentials, run offline tests; a frontend preview must use a clearly identified read-only public API proxy and the current root menu preparation code. The archive in `fixtures/` is never a live nutrition fallback.

Production reads the persistent database catalogue after migration 006, without a file-supplement merge or silent offline fallback. Publication itself never executes database migrations. Unknown, trace, basis and source-definition differences remain explicit.

## Nutrient comparisons

The server reads the persistent `colourfuel_web.catalog` projection and checks migration `006_persistent_ingredient_catalog` in `persistent-catalog.mjs`. Ingredient states, values, sources, image attribution and Irish buying references come from normalized tables. Only concept recipe formulations and static image files remain application assets. The parameterized read-only query in `nutrient-ranking-query.mjs` calculates descending ranks, ties, coverage and exact numeric percentages on PostgreSQL for both estimate policies. Percentages are query results, never fixed columns; the browser hydrates the returned results and does not rank food amounts. The same metric definition, unit and per-100-g edible basis are required. Known zeros remain in the comparison pool; missing, trace, non-numerical bounds, excluded estimates and incompatible bases remain outside it. Per-100-ml records are not silently converted to grams.

Rank is one plus the number of strictly greater values. Ties share a rank; the top percentage includes the whole tied group and rounds upward to an integer. A percentile badge needs at least ten numerical records. The three ingredient highlights are selected from vitamins, minerals, protein and fibre using the database-returned relative positions. Raw/cooked/dried states are separate preparation records; this is concentration, not a serving recommendation, an overall health score or a regulated nutrition claim. Ingredient search, food groups and retailer filters do not change the global library comparison pool. Nutrient routes can be linked directly, e.g. `#ingredients/nutrient/vitamin_c`.

The transactional migration in `migrations/` has already been applied; do not rerun it as part of ordinary publishing. It was imported into Cloud SQL and verified on 18 November 2026 (operation `d471bdf0-6936-485e-bd70-000b00000024`, completed `21:42:56.477Z`); production uses those tables. The migration persists all 114 preparation records (including the 82 former supplements) plus 3,661 nutrient observations, 114 photo records and 120 buying references. It retains the old normalized source data and recipes, records a checksum and original view definition for recovery, and preserves the existing SELECT-only runtime permission. See `migrations/README.md` for the verified execution and rollback order. Migration fixtures and the old ingredient modules are excluded from the deployed runtime; no file fallback is permitted.

## Irish buying references

`irish-shopping.mjs` keeps retail evidence separate from food-composition records. References were reviewed on 17 November 2026 from official Irish retailer/product pages, including Tesco, ALDI, SuperValu, Holland & Barrett, Picado and The Village Butcher. Lidl has an official chicken-range reference, not a confirmed individual SKU; M&S and Donnybrook Fair are directory/store enquiries only. No live prices or stock are asserted. Retail availability in Ireland does not establish Irish-grown origin.

Preparation differences remain explicit: dry grains/pulses need cooking, fresh citrus needs juicing, frozen edamame needs cooking, canned fish uses drained weight, and raw meat/fish links are not ready-cooked products. Branded alternatives do not replace the generic or manufacturer nutrition reference used by the builder and Passport. Updating a buying link must retain the URL, review date, pack size, reference type and matching caveats.

## Images and sources

Ingredient photo credits/licences are retained in `ingredient-photo-credits.json` and ingredient details. Nine ingredient images are clearly labelled AI concepts; their complete prompts and asset identifiers are in `ingredient-image-generation.json`. Bowl/sauce concept imagery has its own provenance in `image-generation.json`. Images identify ingredient/serving concepts, not verified supplier products or exact portions.

## Photo nutrition estimate (iPhone app)

`/api/photo-estimate` lets the iPhone app send one meal photo. The server asks Claude (`claude-opus-5-5`, structured JSON output) to name the visible foods, match them to this library's `variant_id`s and estimate edible grams. It never asks the model for nutrient values: the app calculates nutrition from the PostgreSQL records for matched foods only. Unmatched foods and sauces are shown as "not counted".

- Photos are handled in memory for one request and are never stored or logged. The app re-encodes images (max 1280 px JPEG) before upload, which drops location and camera metadata, and asks for consent before the first photo.
- Limits: 8 photos per client per hour and 150 per day for the service (in memory; the service runs one instance).
- Foods missing from the library are added to it automatically (migration 007): Claude reads a visible pack nutrition label, otherwise the server searches USDA FoodData Central and Claude picks the record that matches the food and preparation state. Nutrient values always come from that label or record, never from the model. The database function `colourfuel_catalog.add_photo_food` validates and inserts the food, its nutrients (unknown values stay `missing`), a placeholder photo record and an audit row; the runtime account can execute only that function and cannot change or delete existing foods. Added foods carry `photo_addition` and `verification_status: photo_added_unreviewed`; the app labels each food as Library, Library · added from a photo, or Added to library now. Limits: 3 additions per photo, 50 per day. Added foods start with the ColourFuel placeholder; the server then looks for an openly licensed Wikimedia Commons photo (CC0, public domain, CC BY, CC BY-SA; author and licence stored), Claude confirms it shows the food, and migration 008's function stores the JPEG in PostgreSQL and replaces the placeholder once. The server serves it at `/ingredient-photo-<variant>.jpg`. Customer photos are never used. Next time the same food is matched straight from the library without any lookup.
- Off by default. `GET /api/photo-estimate` returns `{"available": false}` until `ANTHROPIC_API_KEY` is set on the Cloud Run service (food additions also use `USDA_FDC_API_KEY`), ideally from Secret Manager (`--update-secrets=ANTHROPIC_API_KEY=<secret>:latest`) with access for the service account. Never put the key in this repository.

## Deployment

Owner publishing preference (19 November 2026): a request to “upload/update to GitHub” means deliver the tested change to `main` and verify the resulting deployment. A temporary branch/PR may be used for review, but do not stop at an unmerged PR. Report the live deployment result.

The existing main-branch Cloud Build trigger runs checks/tests, builds the production container and deploys the `colourfuel-web` Cloud Run service. No database migrations run during deployment. `public-assets.mjs` is the explicit allowlist; server/database code, deployment configuration, tests, fixtures and the review directory are not public HTTP assets. The review directory and fixtures are excluded from the runtime container.

## Irish ingredient expansion — 17 November 2026

The first broader-market batch adds 50 distinct ingredients beyond the Bowl menu, each with an independently reviewed Irish retailer product page, generic USDA SR Legacy food/state reference and attributed ingredient photograph. The catalogue now has 114 preparation records / 112 ingredient types and 120 buying references (119 products and one Lidl range). Evidence and source-file SHA-256 are retained in `research/ireland-expansion-2026-11-17.json`. New numerical values are copied only from exact metric definitions, units and 100 g edible basis in the previously retrieved official dataset; missing values remain missing. Generic edible-pod peas are labelled as a cultivar reference estimate. Buying links are not supplier-equivalence or current-stock claims.

The original `irish-ingredient-expansion.mjs` is retained solely as historical import evidence and for offline regressions; it is excluded from the runtime container. No fixed percentile is stored, and the growing population changes rankings automatically (e.g. broccoli Vitamin C: 89.2 mg/100 g, rank 7 of 111 comparable records, Top 7% with estimates in this release). Catalogue counts and ranking coverage come from the returned snapshot. Existing Bowl formulations, required sauces and sharing retain their previous behavior.

This is an expanding researched catalogue, not an exhaustive inventory of foods sold in Ireland. The verified persistence migration replaces the previous 32-database-plus-82-supplement arrangement. The runtime database identity stays read-only.
