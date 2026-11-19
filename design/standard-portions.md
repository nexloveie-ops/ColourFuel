# Proposed standard portions v2

Local review only. These weights are proposed kitchen test units, not validated shop portions. Existing menu originals have intentionally changed to whole/half units; existing saved recipes and shared gram weights are not migrated.

- Cooked chicken, tuna, pork, salmon, cooked chickpeas and edamame: 50 g, whole units.
- Cooked brown rice and quinoa: 50 g, half units allowed (25 g increments).
- Broccoli, carrot, red pepper, tomato, cucumber, purple cabbage and cooked sweetcorn: 50 g, whole units.
- Spinach and feta: 25 g; spring onion: 10 g; sesame and oil: 5 g, whole units.
- Each sauce uses its existing suggested test quantity as one unit: 20, 25 or 30 g. At least one unit is required.
- Other library foods have a labelled suggested starting standard; those are not confirmed kitchen specifications.

Recipe originals v2 (per bowl)

- Everyday Chicken: chicken 100 g, rice 150 g, broccoli/carrot/pepper 50 g each, oil 5 g.
- Rainbow Chicken: chicken/quinoa 100 g each, broccoli/carrot/pepper 50 g each, oil 10 g.
- Plant Power Crunch: chickpeas 150 g, quinoa 100 g, spinach 25 g, carrot/pepper 50 g each, oil 10 g.
- Mediterranean Garden: quinoa/chickpeas 100 g each, tomato/cucumber 50 g each, spinach/feta 25 g each, oil 5 g.
- Asian Sesame Crunch: rice 150 g, edamame 100 g, cabbage/carrot/cucumber 50 g each, spring onion 10 g, sesame 5 g.
- Coastal Colour: tuna 100 g, rice 150 g, spinach 25 g, tomato/cucumber/sweetcorn 50 g each.
- Crispy Pork (R&D): pork 100 g, rice 150 g, cabbage/carrot/cucumber 50 g each, spinach 25 g.
- Signature Salmon (R&D): salmon/rice 100 g each, spinach 25 g, tomato/cucumber 50 g each, oil 5 g.

One selected sauce is separate and mandatory. Protein+ adds one 50 g protein/pulse unit; Active Day adds one 50 g cooked grain unit. Those presets are matched to a one-bowl menu original and do not infer personal dietary needs.

Cost setup

`costCents` is cost per unit, `extraPriceCents` is the customer charge per extra unit, and `removalCreditCents` is any explicitly agreed credit. Values remain null and `pricingStatus` pending until independently verified. Unit cost should account for procurement, edible yield and preparation yield; labour, packaging and overhead need their own costing policy. Missing input does not become zero. No generic cents-per-100g fallback remains in the editor.

The current implementation provides versioned configuration and a calculation model, not an authenticated costing administration screen or a production kitchen order system. No database migration or production deployment is part of this local review.

## Owner-authorised demo charge overlay

Invented prices are now available separately from the pending real configuration: cooked chicken/tuna +€1.50 per 50 g unit, salmon +€2.00, pork +€1.75, chickpeas +€0.50, edamame +€0.75, rice +€0.50, quinoa +€0.60, vegetables +€0.40, spinach +€0.30, feta +€0.75, spring onion/oil +€0.10, sesame +€0.15. Other library ingredients use a labelled demo +€0.50 unit charge. Extra sauce is +€0.50; one sauce portion is included. No removal discount is assumed. These are interaction-test amounts, not market research, costing or proposed verified selling prices. Actual cost fields stay null.
