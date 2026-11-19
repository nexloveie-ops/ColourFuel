import Foundation

/// Bowl share links compatible with the website's `encodeShare()` / `#bowl/<product>/shared/<code>` route:
/// base64url (no padding) of `{"v":1,"original":…,"current":…}` using the website's recipe field names.
public enum BowlShare {
    struct WebItem: Encodable { let variant_id: String; let grams: Double }
    struct WebSauce: Encodable { let id: String; let grams: Double }
    struct WebRecipe: Encodable {
        let title: String
        let servings: Int
        let items: [WebItem]
        let source_recipe_id: String
        let mode: String
        let bowl_product_id: String
        let sauce: WebSauce?
        enum CodingKeys: String, CodingKey { case title, servings, items, source_recipe_id, mode, preset_id, bowl_product_id, sauce }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(title, forKey: .title); try c.encode(servings, forKey: .servings); try c.encode(items, forKey: .items)
            try c.encode(source_recipe_id, forKey: .source_recipe_id); try c.encode(mode, forKey: .mode)
            try c.encodeNil(forKey: .preset_id); try c.encode(bowl_product_id, forKey: .bowl_product_id)
            if let sauce { try c.encode(sauce, forKey: .sauce) } else { try c.encodeNil(forKey: .sauce) }
        }
    }
    struct Payload: Encodable { let v = 1; let original: WebRecipe; let current: WebRecipe }

    /// Returns the share code, or nil when the bowl cannot be shared yet (the sauce is required, as on the website).
    public static func code(product: Product, recipe: Recipe, original: BowlRecipe, current: BowlRecipe) -> String? {
        guard let sauce = current.sauce, current.items.contains(where: { $0.grams > 0 }) else { return nil }
        func web(_ r: BowlRecipe, mode: String, sauce: SauceChoice?) -> WebRecipe {
            WebRecipe(title: product.name, servings: 1, items: r.items.map { WebItem(variant_id: $0.variantId, grams: ($0.grams * 10).rounded() / 10) },
                      source_recipe_id: recipe.recipeId, mode: mode, bowl_product_id: product.productId,
                      sauce: sauce.map { WebSauce(id: $0.id, grams: ($0.grams * 10).rounded() / 10) })
        }
        let payload = Payload(original: web(original, mode: "Original Recipe", sauce: nil), current: web(current, mode: "Custom Recipe", sauce: sauce))
        let encoder = JSONEncoder(); encoder.outputFormatting = [.withoutEscapingSlashes]
        guard let data = try? encoder.encode(payload) else { return nil }
        return data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    public static func url(site: URL, productId: String, code: String) -> URL? {
        URL(string: site.absoluteString + "#bowl/\(productId)/shared/\(code)")
    }
}

/// Headline figures for the 1080×1350 social Passport card (port of passport-card.mjs). Never a price.
public struct PassportCardModel: Sendable {
    public struct Macro: Sendable { public let label: String; public let grams: Double? }
    public let name: String
    public let isCustom: Bool
    public let bowlGrams: Double
    public let sauceName: String?
    public let kcal: Double?
    public let macros: [Macro]
    public let changes: [String]

    public init(productName: String, original: BowlRecipe, current: BowlRecipe, catalog: Catalog) {
        let n = NutritionEngine.calculate(current, catalog: catalog)
        func short(_ id: String) -> String {
            let name = catalog.ingredient(id)?.nameEn ?? id
            return name.split(whereSeparator: { ",(—".contains($0) }).first.map { $0.trimmingCharacters(in: .whitespaces) } ?? name
        }
        var deltas: [(String, Double)] = current.items.map { ($0.variantId, $0.grams - original.grams(of: $0.variantId)) }
        deltas += original.items.filter { o in !current.items.contains { $0.variantId == o.variantId } }.map { ($0.variantId, -$0.grams) }
        let changes = deltas.filter { abs($0.1) >= 0.5 }.sorted { abs($0.1) > abs($1.1) }
            .map { "\($0.1 > 0 ? "+" : "−")\(Int(abs($0.1).rounded())) g \(short($0.0))" }
        self.name = productName
        self.changes = Array(changes.prefix(3))
        self.isCustom = !changes.isEmpty
        self.bowlGrams = (n.weight + (current.sauce?.grams ?? 0)).rounded()
        self.sauceName = current.sauce.flatMap { catalog.sauce($0.id)?.name }
        self.kcal = n.value("energy_reported").map { $0.rounded() }
        self.macros = [("Protein", "protein"), ("Carbs", "carbohydrate_by_difference"), ("Fat", "fat"), ("Fibre", "fibre_total_dietary")]
            .map { Macro(label: $0.0, grams: n.value($0.1).map { ($0 * 10).rounded() / 10 }) }
    }
}
