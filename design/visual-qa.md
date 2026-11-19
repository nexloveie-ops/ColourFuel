# Visual-system review inventory

- Menu/home: original logo, four-color line, white canvas, 8 existing Bowls, 4:3 photos, concept/R&D and dietary badges, consistent cards/buttons; inspect desktop and phone.
- Sauce library: 6 core candidates plus 2 R&D, caption outside photo, proposed ingredients, expanded details and pending nutrition; inspect dense expanded card.
- Ingredient library: 114 records / 112 types, equal photo proportions, category chips, retailer filter and search; check selected category, long-name card, no-result state and reset.
- Nutrient view: 33 definitions, descending results, estimate policy toggled off/on, legible amount and source metadata; inspect both desktop list and phone list.
- Ingredient dialog: image, source credits, ranking, RI/NRV context, unknown coverage and buying links; check scrolling, focus and close.
- Bowl editor: editable weights, Original / Protein+ / Active Day selected states, required sauce selection and alternative, live numeric changes, pending full totals, readable controls; inspect narrow viewport.
- Passport: sauce gating then open report, base-only numbers, per-serving scope, ingredient weights, close and export/print controls; ensure report CSS is not clipped.
- Recipes/sharing and saved library: existing routes and controls remain; inspect cards and empty saved state.
- Exploratory cases: long ingredient name in a phone card/dialog; search with no result then clear; repeated preset/sauce changes should preserve visible state and button availability.
- Global: blue focus ring, minimum control heights, 16px form input, no horizontal document overflow at 390px and 1440px, reduced-motion override, metadata at least 12px. Review screenshot quality separately from functional checks.

Validation results are recorded after browser checks; this inventory alone is not a pass.

## Completed review — 18 November 2026

The local preview reads the current public Cloud SQL-backed API through a read-only proxy. No catalogue or production changes were made. Syntax checks and all 48 existing regression tests passed after the markup/copy changes. The project skill passed the bundled skill validator.

Browser review covered 1440 × 1000 and 390 × 844 layouts. Verified 8 Bowl cards and 8 sauce cards, consistent 4:3 card photographs, menu and recipe cards, expanded Caesar sauce ingredients/unknown nutrition, ingredient groups/search/retailer filtering, empty search then reset, both nutrient estimate policies, ingredient/Passport dialogs and long manufacturer ingredient names. At both widths the checked routes had no horizontal document overflow. Ingredient details and Passport had no horizontal content overflow. Tied/multi-digit ranks remain on one line after a phone-layout correction.

Asian Sesame Crunch was exercised through Original, Active Day (rice 190 g) and Protein+ (edamame 140 g), required Roasted Sesame selection and Passport. The report showed the correct base-only values (383.3 kcal, protein 22.2 g) and pending sauce totals; the close control stayed visible while the report content scrolled. Recipe browsing and the empty browser-local saved library remain reachable. No recipes were saved, shared or deleted during this review. Download/print controls remain present and print-specific overrides preserve overflow; an actual print dialog/PDF was not exercised. Reduced-motion and focus-ring rules were reviewed in CSS; no OS motion setting was changed.

Final review found no stretched card photographs, clipped multi-digit ranks, horizontal page overflow in the checked states, or hidden dialog close control. The preview server is intentionally retained for owner review. New visual decisions belong in the shared section and tokens, not an additional theme file.

## Approved direction A / Colour Pop — 19 November 2026

Applied the owner's selected A direction to the actual application, rather than retaining the three-way experiment overlay. Shared tokens now use the approved blue/yellow/purple/red palette and bold sans display headings. Ingredient landing artwork uses the existing Rainbow Chicken photo with its illustrative caption; the nutrient route omits the collage. Menu, sauce and recipe cards, controls, editor and Passport share the same typography, radii and tactile accents. Existing 4:3 food windows, data and all routes are preserved. Card entrances are progressive enhancement, respect reduced motion and do not hide content by default. Newly inserted cards are observed without rewriting rendered data.

Syntax checks and all 48 existing regression tests passed. Browser review at 1440×1000 and 390×844 confirmed the actual ingredient page and its equal photo ratios, 8 Bowl / 8 sauce cards, the menu/home composition, ingredient search including no-result/reset, Broccoli details and source credit, both Vitamin C ranking policies (88/111 including estimates; 86/109 source only), recipe cards and the browser-local saved library empty state. The checked desktop and phone layouts had no horizontal document overflow; ingredient details and Passport had no horizontal content overflow. Nutrient headings are compact and the decorative collage is absent from that route.

Asian Sesame Crunch Protein+ produced 383.3 kcal, 22.2 g protein and 11.1 g fat for the base ingredients, with the required sauce initially gating Passport. Selecting Roasted Sesame enabled the report with 425 g cover weight including sauce and a clear 395 g base-only nutrition scope. On the phone, Plant Power Crunch Active Day and the alternative Citrus Mint sauce were exercised; Passport retained the selected 25 g sauce and visible close control. No recipe was saved or shared during testing. No database, nutrition formulation, price or production-hosting change was made. Print/reduced-motion rules were inspected; actual printing and OS motion-preference switching were not exercised.

## Standard-portion model — 19 November 2026

All 53 tests pass, including new coverage of all eight v2 originals and 16 presets against shared unit definitions, 25 g half-grain increments, whole protein units, batch scaling with sauce, unchanged per-bowl nutrition, engine limits, exact legacy share weights, Passport standard snapshots and the distinction between verified unit cost and add-on price. A previous nutrition-context fixture expectation was deliberately revised for the v2 Asian Sesame Crunch formulation.

Browser review at 1440×1000 and 390×844 exercised Rainbow Chicken's 2→3 chicken portions (100→150 g), quinoa 2→2.5 portions (100→125 g), whole sauce cups and three-bowl scaling. The kitchen sheet correctly showed 450 g chicken, 375 g quinoa and 180 g sauce for the tested three-bowl/double-sauce recipe. The per-bowl comparison stayed independent of batch size, custom pricing stayed pending and no invalid edit entered the stored recipe calculation. The phone check rejected a 2.5-unit protein input with an inline explanation; correcting it restored normal operation. Adding spinach added its 25 g standard portion, not the old arbitrary 50 g amount. Returning to a one-bowl batch re-enabled presets.

All eight Bowl routes were checked on a 390px phone viewport: each had 6–7 portion controls, a kitchen prep sheet, required-sauce gating and no horizontal document overflow. Desktop editor/kitchen checks likewise fit 1440px. The phone Passport retained its 328px content width without horizontal overflow and showed the tested per-bowl figures and kitchen weights. No saved recipe was overwritten. Existing saved/share compatibility is covered by regression tests; no actual print dialog was exercised. The preview uses current local menu preparation with a read-only public production ingredient catalogue; no ingredient data, SQL migration, production deployment or GitHub upload was performed for this change.

## Drag-based portion controls — 19 November 2026

Replaced the ingredient minus/number/plus controls with native range sliders, live portion and gram readouts, and labelled scales. Sauce count now uses the same slider interaction with a required minimum of one unit. No ingredient increment/decrement buttons remain. Whole-food and half-grain steps still use the existing portion conversion and validation model; old custom gram weights remain unchanged until a slider is moved and the nearest-standard starting position is explained.

All 53 regression tests and syntax checks pass. Browser checks covered track clicking and keyboard arrows (protein 2→3 units, grain 2→2.5 units), sauce End key (3 sauce units) and three-bowl scaling (90 g sauce per bowl / 270 g batch). Desktop and 390px phone controls showed live gram readouts and no horizontal page overflow. Native pointer dragging was not separately exercised by the browser automation. The local preview remains available; no upload or deployment was performed.

## Owner-authorised demo pricing — 19 November 2026

Added a separate invented-price overlay with explicit opt-in. Real financial fields remain pending and no demo rate is marked verified. The customer UI labels the sticky per-bowl/batch total and detailed charge breakdown DEMO ONLY / NOT A QUOTE. Extra ingredient rates are shown beside portion standards; one sauce portion is included and extras cost €0.50. Removing base ingredients does not provide a demo discount. Line amounts round to cents before summing.

Syntax checks and all 55 tests pass. New tests verify demo opt-in, unchanged unknown real costs, half-grain pricing, included/extra sauce, no removal discount and three-bowl totals. Browser checks at 1440px and 390px confirmed Rainbow Chicken €8.95 + chicken €1.50 + half quinoa €0.30 + extra sauce €0.50 = €11.25 per bowl / €33.75 for three. The phone price strip stayed visible at 10px from the viewport top while the controls were used and the page had no horizontal overflow. Removing broccoli kept the demo price unchanged. Returning from three bowls to Original retained two sauce portions per bowl, resulting in €9.45 for one bowl; Protein+ then showed €10.95. No browser errors were logged. The full demo pricing breakdown is now above the nutrient comparison. No costs, nutrition, database records, production pages or GitHub branches were published by this change.
