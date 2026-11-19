import SwiftUI
import Observation
import ColourFuelKit

/// Loads the live catalogue from the website API. No offline nutrition fallback (same rule as the website).
@MainActor @Observable
final class CatalogStore {
    enum Phase { case loading, ready(Catalog), failed(String) }
    var phase: Phase = .loading

    func load() async {
        phase = .loading
        do {
            var request = URLRequest(url: CF.site.appendingPathComponent("api/catalog"))
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let catalog = try await Task.detached(priority: .userInitiated) { try Catalog.decode(data) }.value
            guard catalog.dataMode == "live" else { throw URLError(.cannotParseResponse) }
            phase = .ready(catalog)
        } catch {
            phase = .failed("We couldn’t reach the live ingredient data. Check your connection and try again.")
        }
    }
}

/// The bowl the customer is building: one bowl, edible grams, standard portions and a required sauce.
@MainActor @Observable
final class BowlSession {
    let catalog: Catalog
    private(set) var product: Product
    private(set) var original: BowlRecipe
    var current: BowlRecipe
    /// Last change, used to animate the stage chip and its "+50 g" bubble.
    private(set) var lastChange: (id: String, delta: Double, tick: Int)?

    init(catalog: Catalog, product: Product) {
        self.catalog = catalog
        self.product = product
        let recipe = catalog.recipe(for: product).map(BowlRecipe.init(recipe:)) ?? BowlRecipe(items: [])
        self.original = recipe
        self.current = recipe
    }

    func select(_ product: Product) {
        guard product.id != self.product.id, let recipe = catalog.recipe(for: product) else { return }
        self.product = product
        original = BowlRecipe(recipe: recipe)
        current = original
        lastChange = nil
    }

    // MARK: Portions
    func food(_ id: String) -> Ingredient? { catalog.ingredient(id) }
    func standard(_ id: String) -> PortionStandard? { food(id).map(Portions.standard(for:)) }
    func count(_ id: String) -> Double { standard(id).map { Portions.count(grams: current.grams(of: id), $0) } ?? 0 }
    func originalGrams(_ id: String) -> Double { original.grams(of: id) }

    func setCount(_ id: String, _ count: Double) {
        guard let s = standard(id), let index = current.items.firstIndex(where: { $0.variantId == id }) else { return }
        let grams = Portions.grams(count: min(max(count, s.min), s.max), s)
        let delta = grams - current.items[index].grams
        guard abs(delta) > 1e-9 else { return }
        current.items[index].grams = grams
        lastChange = (id, delta, (lastChange?.tick ?? 0) + 1)
    }

    func add(_ id: String) {
        guard !current.items.contains(where: { $0.variantId == id }), let s = standard(id) else { return }
        current.items.append(BowlItem(variantId: id, grams: s.grams))
        lastChange = (id, s.grams, (lastChange?.tick ?? 0) + 1)
    }

    func remove(_ id: String) { current.items.removeAll { $0.variantId == id } }

    // MARK: Presets
    var presets: [Preset] { (catalog.presets ?? []).filter { $0.recipeId == product.recipeId } }
    var isCustom: Bool { current.items != original.items }
    func apply(_ preset: Preset?) {
        current.items = original.items.map { BowlItem(variantId: $0.variantId, grams: preset?.weights[$0.variantId] ?? $0.grams) }
    }
    var activePreset: String? {
        if current.items == original.items { return "Original" }
        return presets.first { p in current.items == original.items.map { BowlItem(variantId: $0.variantId, grams: p.weights[$0.variantId] ?? $0.grams) } }?.label
    }

    // MARK: Sauce (required; nutrition not yet quantified)
    var sauce: Sauce? { current.sauce.flatMap { catalog.sauce($0.id) } }
    var sauceOptions: [Sauce] {
        catalog.sauces.sorted { a, b in
            let pa = a.pairs.contains(product.productId), pb = b.pairs.contains(product.productId)
            return pa != pb ? pa : ((a.rd ?? false) == (b.rd ?? false) ? false : !(a.rd ?? false))
        }
    }
    func choose(_ sauce: Sauce) {
        let portions = current.sauce.flatMap { c in self.sauce.map { c.grams / Portions.sauceStandard($0).grams } } ?? 1
        current.sauce = SauceChoice(id: sauce.id, grams: Portions.grams(count: portions, Portions.sauceStandard(sauce)))
    }
    var sauceCount: Double { sauce.map { Portions.count(grams: current.sauce?.grams ?? 0, Portions.sauceStandard($0)) } ?? 1 }
    func setSauceCount(_ count: Double) {
        guard let s = sauce else { return }
        current.sauce?.grams = Portions.grams(count: min(max(count, 1), 3), Portions.sauceStandard(s))
    }

    // MARK: Results
    var nutrition: NutritionResult { NutritionEngine.calculate(current, catalog: catalog) }
    var originalNutrition: NutritionResult { NutritionEngine.calculate(original, catalog: catalog) }
    var priceCents: Int? {
        guard let base = product.illustrativePriceCents else { return nil }
        return DemoPricing.price(original: original, current: current, catalog: catalog, baseCents: base).totalCents
    }
    var bowlGrams: Double { current.items.reduce(0) { $0 + $1.grams } + (current.sauce?.grams ?? 0) }
}
