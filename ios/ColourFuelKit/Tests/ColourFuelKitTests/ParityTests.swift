import XCTest
@testable import ColourFuelKit

/// The iOS engine must reproduce the website engine exactly. Fixtures come from
/// ios/tools/make-parity-fixtures.mjs, which runs recipe-engine.mjs and portion-standards.mjs.
final class ParityTests: XCTestCase {
    struct Fixture: Decodable {
        struct Value: Decodable { let status: String; let perServing: Double? }
        struct Case: Decodable {
            let productId: String
            let label: String
            let items: [BowlItem]
            let sauce: SauceChoice?
            let weight: Double
            let metrics: [String: Value?]
            let demoPriceCents: Int?
        }
        let cases: [Case]
    }

    func load<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: Data(contentsOf: url))
    }

    func testNutritionAndDemoPriceMatchTheWebsiteEngine() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "catalog-fixture", withExtension: "json", subdirectory: "Fixtures"))
        let catalog = try Catalog.decode(Data(contentsOf: url))
        let fixture = try load("parity", as: Fixture.self)
        XCTAssertEqual(fixture.cases.count, 24)
        for c in fixture.cases {
            let product = try XCTUnwrap(catalog.products.first { $0.productId == c.productId })
            let original = BowlRecipe(recipe: try XCTUnwrap(catalog.recipe(for: product)))
            let current = BowlRecipe(items: c.items, sauce: c.sauce)
            let result = NutritionEngine.calculate(current, catalog: catalog)
            XCTAssertEqual(result.weight, c.weight, accuracy: 1e-9, "\(c.productId) \(c.label) weight")
            for (id, expected) in c.metrics {
                guard let expected else { XCTAssertNil(result.metrics[id], "\(id) should be absent"); continue }
                let got = try XCTUnwrap(result.metrics[id], "\(c.productId) \(c.label) \(id)")
                XCTAssertEqual(got.status.rawValue, expected.status, "\(c.productId) \(c.label) \(id) status")
                if let e = expected.perServing { XCTAssertEqual(got.perServing ?? .nan, e, accuracy: 1e-9, "\(c.productId) \(c.label) \(id)") }
                else { XCTAssertNil(got.perServing) }
            }
            let price = DemoPricing.price(original: original, current: current, catalog: catalog, baseCents: product.illustrativePriceCents ?? 0)
            XCTAssertEqual(price.totalCents, c.demoPriceCents, "\(c.productId) \(c.label) demo price")
        }
    }

    func testBowlAddOnsExcludeRawProteinsAndCondiments() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "catalog-fixture", withExtension: "json", subdirectory: "Fixtures"))
        let catalog = try Catalog.decode(Data(contentsOf: url))
        let ids = FoodGroups.addOnGroups(catalog.ingredients).flatMap { $0.items.map(\.variantId) }
        XCTAssertTrue(ids.contains("avocado--raw"))
        XCTAssertFalse(ids.contains { $0.hasSuffix("--raw") && $0.hasPrefix("chicken-breast") })
    }

    func testShareCodeAndCardModel() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "catalog-fixture", withExtension: "json", subdirectory: "Fixtures"))
        let catalog = try Catalog.decode(Data(contentsOf: url))
        let product = try XCTUnwrap(catalog.products.first { $0.productId == "rainbow-chicken" })
        let recipe = try XCTUnwrap(catalog.recipe(for: product))
        let original = BowlRecipe(recipe: recipe)
        var current = original
        current.items[0].grams += 50
        XCTAssertNil(BowlShare.code(product: product, recipe: recipe, original: original, current: current), "sauce is required")
        current.sauce = SauceChoice(id: "honey-mustard", grams: 25)
        let code = try XCTUnwrap(BowlShare.code(product: product, recipe: recipe, original: original, current: current))
        print("BOWL_SHARE_URL", BowlShare.url(site: URL(string: "https://www.colourfuel.ie/")!, productId: product.productId, code: code)?.absoluteString ?? "")
        XCTAssertNil(code.rangeOfCharacter(from: CharacterSet(charactersIn: "+/=")))
        var b64 = code.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(Data(base64Encoded: b64))) as? [String: Any])
        XCTAssertEqual(json["v"] as? Int, 1)
        let cur = try XCTUnwrap(json["current"] as? [String: Any])
        XCTAssertEqual(cur["bowl_product_id"] as? String, "rainbow-chicken")
        XCTAssertEqual((cur["sauce"] as? [String: Any])?["id"] as? String, "honey-mustard")
        XCTAssertTrue(cur.keys.contains("preset_id"))
        let card = PassportCardModel(productName: product.name, original: original, current: current, catalog: catalog)
        XCTAssertTrue(card.isCustom)
        XCTAssertEqual(card.changes.first, "+50 g Chicken breast")
        XCTAssertEqual(card.sauceName, "Honey Mustard")
        XCTAssertEqual(card.macros.map(\.label), ["Protein", "Carbs", "Fat", "Fibre"])
    }

    func testLiveCatalogueLibraryRules() throws {
        // Uses the full live snapshot when present (ios/tools writes it); skipped otherwise.
        let path = ProcessInfo.processInfo.environment["CF_FULL_CATALOG"] ?? ""
        try XCTSkipIf(path.isEmpty || !FileManager.default.fileExists(atPath: path), "set CF_FULL_CATALOG to a /api/catalog snapshot")
        let catalog = try Catalog.decode(Data(contentsOf: URL(fileURLWithPath: path)))
        let broccoli = try XCTUnwrap(catalog.ingredient("broccoli--raw"))
        XCTAssertEqual(Library.quickLook(broccoli, catalog: catalog), "Vitamin C · 111.5% NRV / 100 g")
        let entries = Library.entries(catalog, includeEstimates: true)
        let summary = try XCTUnwrap(Library.rankSummary(broccoli, entries: entries))
        XCTAssertEqual(summary.metricId, "vitamin_c"); XCTAssertEqual(summary.row.rank, 7); XCTAssertEqual(summary.row.topPercent, 7)
        XCTAssertNil(Library.rankSummary(try XCTUnwrap(catalog.ingredient("carrot--raw")), entries: entries), "no obscure chloride badge")
        XCTAssertEqual(Set(catalog.buying(for: broccoli).map(\.retailerId)), ["tesco", "aldi"])
        XCTAssertEqual(catalog.ingredients.count, 114)
    }

    func testPhotoEstimateCountsOnlyLibraryFoods() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "catalog-fixture", withExtension: "json", subdirectory: "Fixtures"))
        let catalog = try Catalog.decode(Data(contentsOf: url))
        let json = """
        {"estimate_only":true,"is_food_photo":true,"sauce_or_dressing_visible":true,"note":"Rice partly hidden.",
         "foods":[{"label":"Avocado","variant_id":"avocado--raw","grams":60,"confidence":"high"},
                  {"label":"Falafel","variant_id":null,"grams":80,"confidence":"medium"}]}
        """
        let estimate = try PhotoEstimate.decode(Data(json.utf8))
        XCTAssertEqual(estimate.matched.map(\.label), ["Avocado"])
        XCTAssertEqual(estimate.unmatched.map(\.label), ["Falafel"])
        XCTAssertTrue(estimate.sauceOrDressingVisible)
        let recipe = estimate.recipe(grams: ["avocado--raw": 90], catalog: catalog)
        XCTAssertEqual(recipe.items, [BowlItem(variantId: "avocado--raw", grams: 90)])
        XCTAssertNil(recipe.sauce)
        let direct = NutritionEngine.calculate(recipe, catalog: catalog)
        XCTAssertEqual(direct.weight, 90, accuracy: 1e-9)
        XCTAssertTrue(estimate.recipe(grams: ["avocado--raw": 0], catalog: catalog).items.isEmpty)
    }

    func testPortionsAndReferences() {
        let half = PortionStandard(grams: 50, step: 0.5, min: 0, max: 4, suggestedOnly: false)
        XCTAssertEqual(Portions.grams(count: 2.5, half), 125)
        XCTAssertTrue(Portions.isStandard(2.5, half))
        XCTAssertFalse(Portions.isStandard(2.25, half))
        XCTAssertEqual(References.context("protein", value: 10, unit: "g")?.percent ?? 0, 20, accuracy: 1e-9)
        XCTAssertNil(References.context("protein", value: 10, unit: "mg"))
    }
}
