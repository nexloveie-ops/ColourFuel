---
name: colourfuel-ui
description: Maintain ColourFuel's shared visual system across its Bowl menu, sauces, ingredient and nutrient libraries, recipe builder and Nutrition Passport. Use for ColourFuel UI changes and new components; preserve existing nutrition, data and ordering behavior.
---

# ColourFuel UI

Read [the project visual specification](../../../design/visual-system.md) before changing components. `brand-tokens.css` is the shared foundation and is loaded before the layout stylesheets. `white-theme.css` owns the shared visual-system section; edit that section rather than adding a competing theme. Keep page-specific layouts in their existing stylesheets.

Preserve the white canvas, existing logo and approved food imagery. Blue is the primary action, yellow is the selected choice, purple carries explanatory/source information, and cherry red is a restrained brand accent. Do not turn nutrient concentration into a health rating. Always use explicit text alongside dietary, R&D, selection and data-coverage states.

Keep ingredient photos at 4:3 and product/sauce photos at 4:3, using the source photo for identity, not as proof of final portion or supplier equivalence. Maintain captions and credit/licence details. Use approved A / Colour Pop: bold sans-serif headings, yellow underlines, red/blue stickers and tactile food cards. Keep data panels steady and practical; avoid new remote font dependencies.

Preserve all eight Bowls, required sauce selection and alternatives, editable edible weights, presets, source/unknown/estimate handling, ingredient categories, nutrient ranking policies, recipe sharing and Passport. The catalogue comes from persistent PostgreSQL; a visual change does not authorize a schema or data edit.

Review the relevant page, selected/expanded state and dense state at desktop and phone widths. Check long ingredient names, no-result search, keyboard focus, dialog closure and horizontal fit. Print/export has a separate layout and must remain readable. Reuse the available browser session and the permitted browser tooling. Keep a local preview available for owner review; publishing follows the user's current authorization, never a rule implied by this skill.
