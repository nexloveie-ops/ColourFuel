# ColourFuel

ColourFuel's Ireland-market Bowl concept website combines a visual menu, source-linked ingredient information, editable recipes and Nutrition Passports. The production Node server reads the existing Cloud SQL catalogue; it exposes no database-write or ordering endpoints.

## Current website

- Eight Bowl concepts with requested target prices; Crispy Pork and Signature Salmon are R&D and unavailable to order. No Wrap products.
- Suggested edible gram weights, Protein+ and Active Day test presets, and one required sauce with recommended pairings and alternatives.
- Searchable ingredient library with 64 photo-backed records, source provenance, neutral nutrition context and adult reference comparisons.
- Irish buying references for all 64 preparation records (62 ingredient types): 69 product references and one Lidl chicken-range reference, with retailer filtering, pack sizes, review dates and explicit preparation/brand differences. M&S and Donnybrook Fair have separately labelled store-enquiry links.
- Recipe browsing, browser-local saved recipes/version history, sharing and Nutrition Passport download/print.
- White canvas with yellow, blue, purple and cherry red accents. Vegan-base and vegetarian-concept badges distinguish suitable base recipes; sauces, additions and vegetarian-suitable feta need their own checks.

Menu prices are unvalidated targets, not quotes. Finished portions, cooking yield, kitchen feasibility, allergens and cross-contact remain under review. Sauce formulations are not quantified; the editor and Passport show clearly labelled base-only estimates. Full-Bowl totals remain unknown, never zero-filled. No stock availability or orderability is invented.

## Run and test

Use Node 22. Run `npm ci --ignore-scripts`, `npm run check` and `npm test`. `npm start` serves the real app and requires the existing database configuration described in `db.mjs` and `cloudbuild.yaml`. Database credentials are never served to browsers.

For a localhost review without cloud credentials, `cd previews/colourfuel-bowl && npm start` reads the existing public catalogue using a read-only proxy. The archive in `fixtures/` is an offline test fixture and is never a live nutrition fallback.

The UI combines live catalogue records with versioned, source-backed additions in `ingredient-additions.mjs` and `supplier-ingredients.mjs`. Publication does not execute migrations or write these additions into Cloud SQL. Unknown, trace, basis and source-definition differences remain explicit.

## Irish buying references

`irish-shopping.mjs` keeps retail evidence separate from food-composition records. References were reviewed on 17 November 2026 from official Irish retailer/product pages, including Tesco, ALDI, SuperValu, Holland & Barrett, Picado and The Village Butcher. Lidl has an official chicken-range reference, not a confirmed individual SKU; M&S and Donnybrook Fair are directory/store enquiries only. No live prices or stock are asserted. Retail availability in Ireland does not establish Irish-grown origin.

Preparation differences remain explicit: dry grains/pulses need cooking, fresh citrus needs juicing, frozen edamame needs cooking, canned fish uses drained weight, and raw meat/fish links are not ready-cooked products. Branded alternatives do not replace the generic or manufacturer nutrition reference used by the builder and Passport. Updating a buying link must retain the URL, review date, pack size, reference type and matching caveats.

## Images and sources

Ingredient photo credits/licences are retained in `ingredient-photo-credits.json` and ingredient details. Nine ingredient images are clearly labelled AI concepts; their complete prompts and asset identifiers are in `ingredient-image-generation.json`. Bowl/sauce concept imagery has its own provenance in `image-generation.json`. Images identify ingredient/serving concepts, not verified supplier products or exact portions.

## Deployment

The existing main-branch Cloud Build trigger runs checks/tests, builds the production container and deploys the `colourfuel-web` Cloud Run service. No database migrations run during deployment. `public-assets.mjs` is the explicit allowlist; server/database code, deployment configuration, tests, fixtures and the review directory are not public HTTP assets. The review directory and fixtures are excluded from the runtime container.
