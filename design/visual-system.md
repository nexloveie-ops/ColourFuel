# ColourFuel visual system

White, food-led pages with editorial serif headings and practical sans-serif information. This specification applies to the eight Bowl concepts, sauces, ingredient and nutrient libraries, recipe editor, saved recipes, ingredient details and Nutrition Passport. The current work is a local review; it does not change the deployed site or catalogue.

## Foundations

`brand-tokens.css` is the source of shared tokens. White `#ffffff` is the canvas. Ink `#222741` is primary text; `#5b6276` is secondary text. Blue `#294cc7` is for primary actions, active navigation and focus; yellow `#ffda58` marks selected filters and presets, always with dark text. Purple `#7145ad` and its pale surface group source/nutrition information. Red `#c73246` is a restrained brand accent. Yellow, purple and red are not nutrient-health judgements.

Use Georgia for editorial headings, retaining the existing brand character. Use the existing system/Inter sans-serif stack for navigation, copy, labels, controls and numbers, without fetching a font. Body copy is normally 16px, regular labels 14px, secondary captions 12px. Phone card summaries and compact preset controls may use 13px where the 2-column structure requires it. Form controls stay 16px. Use tabular numerals for nutrition and prices. Keep a fixed, non-wrapping column for tied or three-digit nutrient ranks. Desktop page headings scale to 54px; phone headings are 36–38px. Keep body line height around 1.65–1.8 and heading line height around 1.2.

Use 4, 8, 12, 16, 24, 32, 48 and 64px spacing steps. Shared card radius is 16px, controls 8px and large editorial image/dialog radius 24px. Use thin neutral borders and one light hover shadow; do not give every information block a shadow. The content frame is at most 1280px including responsive 20–56px horizontal padding.

## Components

Primary buttons use white text on blue and are at least 48px high. Secondary buttons have a blue border on white. Choice chips and navigation targets are at least 44px high. Active filters/presets use yellow and explicit pressed state. Required sauce cards retain radio controls and a purple selected border; they are never selected solely by a decorative color. Disabled buttons remain readable and visually quiet.

Desktop navigation is a single row when it fits. Below 1100px the logo and saved button form the first row; the links form a horizontally scrollable second row. Links do not wrap into unpredictable extra rows. Keep every route reachable by keyboard and touch.

Product, sauce and ingredient photo windows use a consistent 4:3 ratio. Product and sauce cards use the existing food photography/concepts, with captions outside the image. Ingredient cards use cover images for recognizable identification; the detail view can contain the full photo. Keep names, preparation state, nutrition context, relative library ranking and Irish buying evidence in that order. Credit/licence and AI disclosures stay accessible. Cards align within their grid and long names wrap. On phones, ingredient cards remain two columns; product, sauce and recipe cards become one column for readable descriptions.

Nutrition/source panels use pale blue or purple, clear headings and labelled values. Concept/unfinished-formulation notices use a pale yellow surface with a text explanation. Missing data is unknown, never zero. Adult RI/NRV is a label comparison, not a personal minimum. All-food claims are forbidden when the comparison pool is only the current library. Sauce exclusion must be prominent in base-only estimates and Passport totals.

Dialogs have a visible 44px close control outside the scrollable content area and a neutral dark backdrop. Phone dialogs leave a 10px outer gutter. Keep ingredient photograph, provenance, ranking and nutrition sections readable in the densest state. Passport uses the same typography, card surfaces and numeric hierarchy, with print styles preserving report content while suppressing interactive actions.

## Maintenance and review

Keep shared values in `brand-tokens.css`; edit the shared visual-system section in `white-theme.css` rather than appending ad hoc page themes. Existing structural rules remain in `style.css`, `studio.css` and `visual-menu.css`. Do not edit production data or calculate nutrition in CSS/markup. The server's static asset allowlist must include any new CSS file.

Before signoff, compare menu, sauce library, ingredient cards/detail, nutrient policies, builder preset and required sauce, Passport and recipe-sharing pages at desktop and phone widths. Check long names, empty filters, selected states, reduced-motion behavior, focus visibility and horizontal fit. Keep a reviewable local preview and screenshots. Preserve deployment authorization as given by the owner for the active task.
