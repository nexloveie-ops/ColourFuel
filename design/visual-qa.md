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
