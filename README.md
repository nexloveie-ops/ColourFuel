# ColourFuel

ColourFuel's Ireland-market Bowl concept website combines a visual menu, source-linked ingredient information, editable recipes and Nutrition Passports. The production Node server reads the existing Cloud SQL catalogue; it exposes no database-write or ordering endpoints.

## Current website

- Eight Bowl concepts with requested target prices; Crispy Pork and Signature Salmon are R&D and unavailable to order. No Wrap products.
- Suggested edible gram weights, Protein+ and Active Day test presets, and one required sauce with recommended pairings and alternatives.
- Searchable ingredient library with 114 photo-backed preparation records (112 ingredient types), source provenance, neutral nutrition context and adult reference comparisons.
- Nutrient-first browsing for all 33 tracked definitions, descending per-100-g lists, per-ingredient relative ranks and an estimate-inclusion switch. Rankings use only comparable numerical records in this library, with ties, source coverage and raw/cooked states explicit.
- Irish buying references for all 114 preparation records (112 ingredient types): 119 product references and one Lidl chicken-range reference, with retailer filtering, pack sizes, review dates and explicit preparation/brand differences. M&S and Donnybrook Fair have separately labelled store-enquiry links.
- Recipe browsing, browser-local saved recipes/version history, sharing and Nutrition Passport download/print.
- White canvas with yellow, blue, purple and cherry red accents. Vegan-base and vegetarian-concept badges distinguish suitable base recipes; sauces, additions and vegetarian-suitable feta need their own checks.

Menu prices are unvalidated targets, not quotes. Finished portions, cooking yield, kitchen feasibility, allergens and cross-contact remain under review. Sauce formulations are not quantified; the editor and Passport show clearly labelled base-only estimates. Full-Bowl totals remain unknown, never zero-filled. No stock availability or orderability is invented.

## Run and test

Use Node 22. Run `npm ci --ignore-scripts`, `npm run check` and `npm test`. `npm start` serves the real app and requires the existing database configuration described in `db.mjs` and `cloudbuild.yaml`. Database credentials are never served to browsers.

For a localhost review without cloud credentials, `cd previews/colourfuel-bowl && npm start` reads the existing public catalogue using a read-only proxy. The archive in `fixtures/` is an offline test fixture and is never a live nutrition fallback.

The server combines live catalogue records with versioned, source-backed additions in `ingredient-additions.mjs` and `supplier-ingredients.mjs`. Publication does not execute migrations or write these additions into Cloud SQL. Unknown, trace, basis and source-definition differences remain explicit.

## Nutrient comparisons

The server reads the Cloud SQL catalogue, unifies the versioned additions in `web-catalog.mjs`, and executes the parameterized read-only query in `nutrient-ranking-query.mjs` on PostgreSQL. `RANK()` and partition counts compute descending ranks, ties, coverage and exact numeric percentages for both estimate policies. These are query results, not stored percentage columns. The returned snapshot contains all 114 ingredient preparation records and the database ranking results. `nutrient-explorer.mjs` only validates/hydrates those results and renders them; the browser does not sort amounts or calculate ranks/percentages. Ranking uses this catalogue, not a global foods database. Only the same metric ID, unit and per-100-g edible basis enter a comparison. Known zeros count in the comparison pool; only positive amounts are listed as containing the nutrient. Missing, trace, non-numerical limits, incompatible units/bases and estimates excluded by the visitor remain outside that pool. Manufacturer references retain their source kind. Per-100-ml records need a verified density conversion and are excluded.

Rank is one plus the number of strictly greater values. Ties share a rank; the top percentage includes the whole tied group and rounds upward to an integer. A percentile badge needs at least ten numerical records. The three ingredient highlights are selected from vitamins, minerals, protein and fibre using the database-returned relative positions. Raw/cooked/dried states are separate preparation records; this is concentration, not a serving recommendation, an overall health score or a regulated nutrition claim. Ingredient search, food groups and retailer filters do not change the global library comparison pool. Nutrient routes can be linked directly, e.g. `#ingredients/nutrient/vitamin_c`.

The original 32 catalogue records remain database-backed; the additional 82 records are still versioned source-backed supplements, now merged at the server before PostgreSQL ranking. This release does not migrate those supplements into persistent database tables, change database grants or write to the database. Each API refresh reads the latest live catalogue and reruns the ranking query; the browser may reuse that checked response until refresh. SQL behavior is tested against embedded PostgreSQL (PGlite), including read-only transactions, changing nutrient inputs, nulls, traces, ties and unit/basis exclusions. The PGlite dependency is development-only and is omitted from the production container.

## Irish buying references

`irish-shopping.mjs` keeps retail evidence separate from food-composition records. References were reviewed on 17 November 2026 from official Irish retailer/product pages, including Tesco, ALDI, SuperValu, Holland & Barrett, Picado and The Village Butcher. Lidl has an official chicken-range reference, not a confirmed individual SKU; M&S and Donnybrook Fair are directory/store enquiries only. No live prices or stock are asserted. Retail availability in Ireland does not establish Irish-grown origin.

Preparation differences remain explicit: dry grains/pulses need cooking, fresh citrus needs juicing, frozen edamame needs cooking, canned fish uses drained weight, and raw meat/fish links are not ready-cooked products. Branded alternatives do not replace the generic or manufacturer nutrition reference used by the builder and Passport. Updating a buying link must retain the URL, review date, pack size, reference type and matching caveats.

## Images and sources

Ingredient photo credits/licences are retained in `ingredient-photo-credits.json` and ingredient details. Nine ingredient images are clearly labelled AI concepts; their complete prompts and asset identifiers are in `ingredient-image-generation.json`. Bowl/sauce concept imagery has its own provenance in `image-generation.json`. Images identify ingredient/serving concepts, not verified supplier products or exact portions.

## Deployment

The existing main-branch Cloud Build trigger runs checks/tests, builds the production container and deploys the `colourfuel-web` Cloud Run service. No database migrations run during deployment. `public-assets.mjs` is the explicit allowlist; server/database code, deployment configuration, tests, fixtures and the review directory are not public HTTP assets. The review directory and fixtures are excluded from the runtime container.

## Irish ingredient expansion — 17 November 2026

The first broader-market batch adds 50 distinct ingredients beyond the Bowl menu, each with an independently reviewed Irish retailer product page, generic USDA SR Legacy food/state reference and attributed ingredient photograph. The catalogue now has 114 preparation records / 112 ingredient types and 120 buying references (119 products and one Lidl range). Evidence and source-file SHA-256 are retained in `research/ireland-expansion-2026-11-17.json`. New numerical values are copied only from exact metric definitions, units and 100 g edible basis in the previously retrieved official dataset; missing values remain missing. Generic edible-pod peas are labelled as a cultivar reference estimate. Buying links are not supplier-equivalence or current-stock claims.

The server-only `irish-ingredient-expansion.mjs` is included before the existing PostgreSQL ranking query; it is not served as a frontend asset. No fixed percentile is stored, and the growing population changes rankings automatically (e.g. broccoli Vitamin C: 89.2 mg/100 g, rank 7 of 111 comparable records, Top 7% with estimates in this release). Catalogue counts and ranking coverage come from the returned snapshot. Existing Bowl formulations, required sauces and sharing retain their previous behavior.

This is an expanding researched catalogue, not an exhaustive inventory of foods sold in Ireland. The runtime database identity remains read-only. This release makes no persistent table migration: 32 records are read from Cloud SQL and 82 versioned source-backed supplements are merged server-side. The distinction is retained in the API and website source description.
