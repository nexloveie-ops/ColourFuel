# ColourFuel Bowl review preview

This directory contains the current locally reviewed concept website. It is intentionally separate from the root production app and does not change deployment configuration. Run `npm start` here and open http://127.0.0.1:4187/#products. Use `npm run check` and `npm test` for validation. No installation or credentials are needed; Node 22 is recommended. The public live catalogue connection is read-only and requires network access. The JSON under `fixtures/` is an archived offline test fixture and is never used as a runtime live-data fallback.

## Preview details

Open http://127.0.0.1:4187/#products. Run `npm start` here to restart. This copy listens on localhost and reads the existing public catalogue via GET only. No production records, checkout, database, repository, deployment or inventory were changed.

## Current behaviour

All eight requested Bowl concepts have their requested target prices, illustrative photographs and proposed edible gram weights. Crispy Pork and Signature Salmon remain R&D/unavailable to order. Every selected Bowl opens directly into Make it yours with the ingredient weights; there is no additional Build gate or baseline selector. Generic Recipe Studio, recipe gallery, sources, browser-local saves/version history and sharing remain accessible.

Every menu Bowl requires one sauce before save/share/Passport. All eight candidates can be selected, recommendations appear first, and sauce weight is editable. Share payloads preserve sauce ID and weight. Default sauce portions are suggestions only. No final weighed sauce formulations exist, so sauce and full-Bowl nutrients stay pending. The builder separately shows explicitly labelled base-only estimates excluding sauce. Unknown nutrients are never treated as zero. Existing Protein+/Active Day presets still work on their reviewed base ingredients.

The interface uses white backgrounds, blue controls, yellow notes and purple accents. Existing logos and imagery are retained. AI concept photographs and shared serving inspiration remain labelled.

## Source additions

The preview merges 32 source-backed local ingredient additions with 32 existing live records, giving 64 searchable ingredients. 29 additions were extracted from the official USDA SR Legacy records already downloaded for this project; three are manufacturer references. `ingredient-research.json` retains record evidence and original source information. Each ingredient detail shows values, basis, food state, source and matching notes. Sauce ingredient chips open those same library entries.

Pork shavings use an explicitly labelled roasted-lean-pork reference estimate, not an exact final crispy product. Generic mayonnaise does not certify a chosen supplier's pasteurisation or allergens. Dijon is a Maille French-market reference pending Irish supplier confirmation. Rice vinegar preserves the manufacturer's per-100ml figures; no density conversion to gram-based nutrient arithmetic is made. Chipotle uses a clearly dated 2019 manufacturer reference, not a current supplier approval. Missing values remain unknown. USDA carbohydrate-by-difference and dietary fibre definitions remain separate from CoFID definitions.

Local additions are not written to the cloud catalogue. A live connection remains necessary to initialise the existing catalogue. Target prices are not costed; final portions, yield, kitchen feasibility and allergen/cross-contact review remain pending. Nothing can be ordered through this concept preview.

## Verification

Run `npm run check` and `npm test`. Checks cover syntax and 15 regression cases: existing arithmetic/source/preset/share behaviour, all eight formulations, mandatory sauce selection, preservation of sauce weights in share links, pending full-Bowl nutrition, per-100ml exclusion, explicit pork reference matching and all sauce ingredient/library links. Browser checks cover source-backed ingredient details, direct Bowl editing, alternative sauce selection, adjusted sauce weight and sharing, and responsive layout.

## Nutrition context and all-eight presets (16 November 2026)

All eight menu bowls now have both Protein+ and Active Day proposed test presets (16 total). The six existing reviewed rules are retained; ten local rules fill the remaining gaps. Each rule checks the exact baseline, food source identities and a numeric increase in its named base metric before use. Protein+ adds an existing protein ingredient; Active Day adds cooked grains. Sauce selection/weight are retained. These rules do not estimate individual exercise needs.

See what changes now leads with numerical base-ingredient comparisons, explicitly excluding sauce, rather than a blank full-bowl comparison. It includes deltas and adult reference percentage bars. Complete-bowl Passport nutrition remains pending while sauce composition is unknown. Energy uses one decimal place to avoid confusing rounding differences. Fibre and carbohydrate source definitions remain distinct.

Ingredient library cards now show a source-backed characteristic; details add a feature summary and contextual bars beside individual values. Protein/fibre are prioritised in summaries when they contribute at least 15% of the displayed adult reference, followed by available nutrient contributions. Display bands are <15%, 15–<30%, and >=30%; these mean smaller/middle/larger daily contribution, not regulated low/high nutrition claims or a whole-food health rating. Watch-style bars for fat, saturates and salt do not encourage filling their references. Unknown, trace or mismatched nutrient definitions get no invented percentage; manufacturer per-100ml basis and less-than values remain explicit.

References checked: EU 1169/2011 Annex XIII, consolidated 1 April 2025, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011R1169-20250401 ; EFSA adult dietary-fibre adequate intake 25 g/day, https://www.efsa.europa.eu/en/press/news/nda100326 . RI/NRV and fibre AI are separate label/education references, not universal minimums or personalised advice.

19 regression checks pass. Browser verification covered both Asian Sesame Crunch presets, numerical deltas and reference shares, food-detail feature summaries, retaining a 30 g Roasted Sesame selection while switching presets, and no horizontal overflow at desktop/390px widths (including ingredient dialog). No user recipe was saved during these checks. Source and production services were not changed.

## Passport correction and photo ingredient library

Passport display now uses the same known base-ingredient nutrition as the editor, with a prominent excludes-sauce basis and reference percentages. It shows the current editable recipe, original/current comparisons, and all 34 nutrient metrics with complete values or explicitly labelled known subtotals and unresolved/trace record counts. The cover weight includes the required sauce; the nutrient section states its separate base-only weight. Complete bowl totals are not invented. JSON exports retain the original full-bowl nutrition/comparison and add `base_nutrition`, `base_comparison` and `nutrition_basis`, so data consumers can distinguish both scopes. Existing generic recipe reports retain their original basis.

All 64 ingredient variants have local identification photographs in the library and detail dialogs. Raw and cooked chicken/salmon variants use separate images. Search and nutrition-context summaries remain available. Photos identify an ingredient and are not claimed to show a chosen supplier product, exact cultivar, preparation method or serving weight. The record's stated food state controls nutrition arithmetic.

55 source photographs retain attribution and licence links in ingredient details; nine built-in image_gen concepts are explicitly marked AI illustration. These are fresh dill, plain cooked lentils/chickpeas, roasted chicken breast, crisp pork concept, firm tofu, drained tuna, lemon juice and lime juice. The image prompt set and saved asset paths are in `ingredient-image-generation.json`; full image credits are in `ingredient-photo-credits.json`. Source compositions were retained while resizing/JPEG encoding. No third-party image is represented as ColourFuel's own supplier photography.

22 regression tests pass, covering source arithmetic, all-eight presets, sauce selection/sharing, separate Passport data scopes and coverage of every ingredient variant with a local valid JPEG and photo provenance. Browser checks confirmed Asian Sesame Crunch Protein+ Passport shows 383.3 kcal / 22.2 g protein / 11.1 g fat for the base recipe, with 29 of 34 nutrient totals complete, instead of blank values. The remaining gaps stay explicit. All 64 photo cards render, visible images load, mobile search works, raw/cooked chicken photos differ, and the ingredient dialog fits 390px width. No production publication or database writes occurred.
