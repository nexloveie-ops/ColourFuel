# ColourFuel iPhone app (SwiftUI)

Direction 3, "Bowl stage": the bowl is the interface. Food photo chips sit around the bowl, sized by grams; tap a food to drag its standard portions and see its nutrition and change; the energy ring, DEMO price and nutrition stay in the dock.

- `ColourFuel/` — the app (iOS 17+, SwiftUI). Reads the live catalogue from `https://www.colourfuel.ie/api/catalog` and photos from the same site. No offline nutrition fallback.
- `ColourFuelKit/` — Swift package: catalogue models, nutrition engine, standard portions, DEMO pricing, food groups. Ports of `recipe-engine.mjs`, `portion-standards.mjs`, `nutrition-context.mjs` and `ingredient-library.mjs`.
- `tools/make-parity-fixtures.mjs` — runs the website's own engine to produce the Swift parity fixtures.

Same rules as the website: Bowl only; required sauce whose nutrition is not yet quantified (base ingredients only, excludes sauce); adult RI/NRV are comparisons, not minimums; prices are DEMO ONLY and nothing can be ordered.

## Build and test

```bash
cd ios/ColourFuelKit && swift test
```

```bash
cd ios && xcodebuild -project ColourFuel.xcodeproj -scheme ColourFuel -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Refresh the parity fixtures after engine or catalogue changes:

```bash
curl -s https://www.colourfuel.ie/api/catalog -o /tmp/catalog.json && node ios/tools/make-parity-fixtures.mjs /tmp/catalog.json
```

The `ios/` folder is excluded from the website container (`.dockerignore`). Signing, a bundle identifier you own and TestFlight need the owner's Apple Developer account.
