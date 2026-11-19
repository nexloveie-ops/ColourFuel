# ColourFuel visual system

Approved direction A / Colour Pop: white, food-led pages with bold sans-serif headings, bright colour fields, tactile cards and practical information. This specification applies to the eight Bowl concepts, sauces, ingredient and nutrient libraries, recipe editor, saved recipes, ingredient details and Nutrition Passport. The current work is a local review; it does not change the deployed site or catalogue.

## Foundations

`brand-tokens.css` is the source of shared tokens. White `#ffffff` is the canvas. Ink `#24243f` is primary text; `#5b6276` is secondary text. Blue `#294bd1` is for primary actions, active navigation and focus; yellow `#ffda42` marks selected filters and presets, always with dark text. Purple `#783ec2` and its pale surface group source/nutrition information. Red `#d32d43` is a restrained brand accent. Yellow, purple and red are not nutrient-health judgements.

Use Arial/Helvetica Neue/system sans for bold display headings (750–850), with tight tracking and no remote font dependency. Use the existing system/Inter sans-serif stack for navigation, copy, labels, controls and numbers, without fetching a font. Body copy is normally 16px, regular labels 14px, secondary captions 12px. Phone card summaries and compact preset controls may use 13px where the 2-column structure requires it. Form controls stay 16px. Use tabular numerals for nutrition and prices. Keep a fixed, non-wrapping column for tied or three-digit nutrient ranks. The ingredient hero scales to 74px desktop / 48px phone; information-heavy headings stay 28–54px. Keep body line height around 1.65–1.8 and heading line height around 1.2.

Use 4, 8, 12, 16, 24, 32, 48 and 64px spacing steps. Shared card radius is 22px, inputs 8px and large editorial image/dialog radius 24px. Use neutral 1.5px card borders with a light bottom shadow. Fine-pointer hover lifts food cards onto a yellow offset shadow; every fourth second ingredient card uses lilac. Information panels remain steady. Primary buttons are pills with an ink offset shadow. The content frame is at most 1280px including responsive 20–56px horizontal padding.

## Components

Primary buttons use white text on blue and are at least 48px high. Secondary buttons have a blue border on white. Choice chips and navigation targets are at least 44px high. Active filters/presets use yellow and explicit pressed state. Required sauce cards retain radio controls and a purple selected border; they are never selected solely by a decorative color. Disabled buttons remain readable and visually quiet.

Desktop navigation is a single row when it fits. Below 1100px the logo and saved button form the first row; the links form a horizontally scrollable second row. Links do not wrap into unpredictable extra rows. Keep every route reachable by keyboard and touch.

Product, sauce and ingredient photo windows use a consistent 4:3 ratio. Product and sauce cards use the existing food photography/concepts, with captions outside the image. Ingredient cards use cover images for recognizable identification; the detail view can contain the full photo. Keep names, preparation state, nutrition context, relative library ranking and Irish buying evidence in that order. Credit/licence and AI disclosures stay accessible. Cards align within their grid and long names wrap. On phones, ingredient cards remain two columns; product, sauce and recipe cards become one column for readable descriptions.

Nutrition/source panels use pale blue or purple, clear headings and labelled values. Concept/unfinished-formulation notices use a pale yellow surface with a text explanation. Missing data is unknown, never zero. Adult RI/NRV is a label comparison, not a personal minimum. All-food claims are forbidden when the comparison pool is only the current library. Sauce exclusion must be prominent in base-only estimates and Passport totals.

Dialogs have a visible 44px close control outside the scrollable content area and a neutral dark backdrop. Phone dialogs leave a 10px outer gutter. Keep ingredient photograph, provenance, ranking and nutrition sections readable in the densest state. Passport uses the same typography, card surfaces and numeric hierarchy, with print styles preserving report content while suppressing interactive actions.

## Maintenance and review

Keep shared values in `brand-tokens.css`; edit the shared visual-system section in `white-theme.css` rather than appending ad hoc page themes. Existing structural rules remain in `style.css`, `studio.css` and `visual-menu.css`. Do not edit production data or calculate nutrition in CSS/markup. The server's static asset allowlist must include any new CSS file.

Before signoff, compare menu, sauce library, ingredient cards/detail, nutrient policies, builder preset and required sauce, Passport and recipe-sharing pages at desktop and phone widths. Check long names, empty filters, selected states, reduced-motion behavior, focus visibility and horizontal fit. Keep a reviewable local preview and screenshots. Preserve deployment authorization as given by the owner for the active task.

## Approved A composition and motion

The ingredient landing hero reads “Good food. In full colour.” with blue display text, a yellow underline, yellow/lilac orbits and the existing round-cropped Rainbow Chicken concept photo. Red and blue stickers carry non-nutritional brand copy; the illustrative caption stays visible. The nutrient route omits the collage and uses a compact heading so current database results and comparison policies remain primary. Food library photos stay 4:3.

An IntersectionObserver adds a short, staggered entrance only as visible cards enter; content is visible by default and works without motion APIs. Reduced-motion disables entrances, lifts and transitions. No experimental theme switcher or demo data enters the application.

## Standard-portion model

Bowl editor controls are draggable native range sliders with live portion/gram readouts and keyboard arrow support. They select standard portion counts **per bowl**, backed by exact edible grams. Shared proposals live in `portion-standards.mjs`, with separate unit cost, extra selling price and removal-credit fields; financial fields remain null pending costing. `menu-formulations.mjs` defines explicitly revised v2 concept originals and their 16 matching presets. Menu foods use whole portions; cooked rice and quinoa permit half portions. Sauces are required and use whole sauce portions. These are kitchen units, not dietary serving advice.

Changing the bowl count scales ingredient and sauce batch weights together; nutritional comparisons remain per bowl. The kitchen sheet shows preparation state, unit grams, portions and grams per bowl, total batch amounts and proposed handling. Pre-weigh portions before calibrating scoops, tongs or pumps. No utensil accuracy is asserted. Batch sizes exceeding the engine's weight limits, or requiring a silent rounding of old custom weights, are rejected.

Saved/shared recipes retain exact gram weights. A non-aligned old amount is labelled custom and is only aligned when the owner deliberately changes its count. Invalid count edits keep the last valid recipe calculation and block save/share/Passport until corrected. Passport/download includes a snapshot of current suggested standards and batch weights. An original Bowl target price is distinct from a custom quote: no unverified cost, add-on price or removal refund may be invented. Existing menu targets still await costing.

## Explicit demo pricing

The owner requested invented demonstration charges on 19 November 2026. The real unit cost and selling-price definitions remain pending. A separate `demoFoodStandard` / `demoSauceStandard` overlay supplies charges only when `allowDemo: true` is explicitly passed to the pricing calculator. Never mark these rates verified. UI totals and breakdowns must say DEMO ONLY / NOT A QUOTE and must not appear as checkout prices.

The demo charges only for portions above the menu original; removals have an explicit zero credit. The first selected sauce portion is included; extra portions cost €0.50 each in the demo. Half-grain portions use half the unit charge. Round each line to cents before summing so the displayed breakdown matches the per-bowl total. Batch total is the rounded per-bowl total times bowl count. Show a compact sticky demo total while sliders are used, with the complete breakdown at the top of the comparison panel.
