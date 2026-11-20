import Foundation

/// The public catalogue served by `GET /api/catalog` (persistent PostgreSQL behind the website).
/// Only the fields the app uses are decoded; unknown fields are ignored.
public struct Catalog: Decodable, Sendable {
    public let readAt: String?
    public let dataMode: String?
    public let metrics: [Metric]
    public private(set) var ingredients: [Ingredient]
    public let recipes: [Recipe]
    public let products: [Product]
    public let sauces: [Sauce]
    public let presets: [Preset]?
    public let ingredientPhotos: [IngredientPhoto]?
    public let nutrientRankings: NutrientRankings?
    public let irishBuyingReferences: [BuyingReference]
    public let irishRetailers: [Retailer]
    private let photoRecords: [String: IngredientPhoto]
    private var ingredientIndex: [String: Ingredient]
    private let photoIndex: [String: String]

    enum CodingKeys: String, CodingKey { case readAt, dataMode, metrics, ingredients, recipes, products, sauces, presets, ingredientPhotos, nutrientRankings, irishBuyingReferences, irishRetailers }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        readAt = try c.decodeIfPresent(String.self, forKey: .readAt)
        dataMode = try c.decodeIfPresent(String.self, forKey: .dataMode)
        metrics = try c.decode([Metric].self, forKey: .metrics)
        ingredients = try c.decode([Ingredient].self, forKey: .ingredients)
        recipes = try c.decode([Recipe].self, forKey: .recipes)
        products = try c.decode([Product].self, forKey: .products)
        sauces = try c.decodeIfPresent([Sauce].self, forKey: .sauces) ?? []
        presets = try c.decodeIfPresent([Preset].self, forKey: .presets)
        ingredientPhotos = try c.decodeIfPresent([IngredientPhoto].self, forKey: .ingredientPhotos)
        nutrientRankings = try c.decodeIfPresent(NutrientRankings.self, forKey: .nutrientRankings)
        irishBuyingReferences = try c.decodeIfPresent([BuyingReference].self, forKey: .irishBuyingReferences) ?? []
        irishRetailers = try c.decodeIfPresent([Retailer].self, forKey: .irishRetailers) ?? []
        photoRecords = Dictionary((ingredientPhotos ?? []).map { ($0.variantId, $0) }, uniquingKeysWith: { a, _ in a })
        ingredientIndex = Dictionary(ingredients.map { ($0.variantId, $0) }, uniquingKeysWith: { a, _ in a })
        photoIndex = Dictionary((ingredientPhotos ?? []).map { ($0.variantId, $0.image) }, uniquingKeysWith: { a, _ in a })
    }

    public static func decode(_ data: Data) throws -> Catalog {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(Catalog.self, from: data)
    }

    public func ingredient(_ variantId: String) -> Ingredient? { ingredientIndex[variantId] }
    /// The same catalogue plus foods the server just added to the library (photo estimate).
    public func adding(_ extra: [Ingredient]) -> Catalog {
        var copy = self
        for food in extra where copy.ingredientIndex[food.variantId] == nil {
            copy.ingredients.append(food); copy.ingredientIndex[food.variantId] = food
        }
        return copy
    }
    public func sauce(_ id: String) -> Sauce? { sauces.first { $0.id == id } }
    public func photo(for variantId: String) -> String? { photoIndex[variantId] }
    public func photoRecord(for variantId: String) -> IngredientPhoto? { photoRecords[variantId] }
    public func metric(_ id: String) -> Metric? { metrics.first { $0.metricId == id } }
    public func retailer(_ id: String) -> Retailer? { irishRetailers.first { $0.id == id } }
    /// Researched Irish buying references for a food (by preparation record, else by ingredient).
    public func buying(for food: Ingredient) -> [BuyingReference] {
        irishBuyingReferences.filter { $0.variantId == food.variantId || ($0.variantId == nil && $0.ingredientId == food.ingredientId) }
    }
    public func recipe(for product: Product) -> Recipe? { recipes.first { $0.recipeId == product.recipeId } }

    /// The fixed Bowl menu (products with a target price and a Bowl recipe), in served order.
    public var bowls: [Product] { products.filter { $0.illustrativePriceCents != nil && recipe(for: $0)?.bowlProductId != nil } }
}

public struct Metric: Decodable, Sendable, Hashable {
    public let metricId: String
    public let nameEn: String
    public let unit: String
}

public struct Nutrient: Decodable, Sendable, Hashable {
    public let metricId: String
    public let unit: String?
    public let result: String?
    public let primaryValue: Double?
    public let filledValue: Double?
}

public struct Ingredient: Decodable, Sendable, Identifiable, Hashable {
    public let variantId: String
    public let ingredientId: String
    public let nameEn: String
    public let state: String
    public let category: String
    public let datasetId: String?
    public let verificationStatus: String?
    public let nutrients: [Nutrient]
    public let recordId: String?
    public let sourceName: String?
    public let sourceUrl: String?
    /// Present when the food was added automatically from a customer photo (migration 007).
    public let photoAddition: PhotoAddition?
    public var id: String { variantId }

    public struct PhotoAddition: Decodable, Sendable, Hashable {
        public let sourceType: String
        public let reviewStatus: String?
        public var sourceLabel: String { sourceType == "pack_label" ? "pack label" : "USDA FoodData Central" }
    }
}

public struct RecipeItem: Decodable, Sendable, Hashable {
    public let variantId: String
    public let edibleGrams: Double
}

public struct Recipe: Decodable, Sendable, Hashable {
    public let recipeId: String
    public let titleEn: String
    public let bowlProductId: String?
    public let servings: Double
    public let items: [RecipeItem]
    public let image: String?
}

public struct Product: Decodable, Sendable, Identifiable, Hashable {
    public let productId: String
    public let name: String
    public let illustrativePriceCents: Int?
    public let rd: Bool?
    public let image: String?
    public let small: String?
    public let description: String?
    public let collection: String?
    public let ingredients: String?
    public let imageNote: String?
    public let recipeId: String
    public var id: String { productId }
    public var isResearch: Bool { rd == true }
}

public struct Sauce: Decodable, Sendable, Identifiable, Hashable {
    public let id: String
    public let name: String
    public let flavour: String?
    public let ingredients: [String]
    public let review: String?
    public let pairs: [String]
    public let defaultGrams: Double
    public let image: String?
    public let small: String?
    public let rd: Bool?
}

public struct Preset: Decodable, Sendable, Hashable {
    public let presetId: String
    public let recipeId: String
    public let label: String
    public let weights: [String: Double]
}

public struct IngredientPhoto: Decodable, Sendable, Hashable {
    public let variantId: String
    public let image: String
    public let artist: String?
    public let license: String?
    public let sourceUrl: String?
    public let generated: Bool?
}

public struct BuyingReference: Decodable, Sendable, Hashable {
    public let url: String
    public let product: String?
    public let pack: String?
    public let note: String?
    public let match: String?
    public let retailerId: String
    public let reviewedOn: String?
    public let evidenceType: String?
    public let ingredientId: String?
    public let variantId: String?
}

public struct Retailer: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let url: String?
}

/// Library rankings computed by PostgreSQL (two policies: with and without labelled reference estimates).
public struct NutrientRankings: Decodable, Sendable {
    public let withEstimates: [RankingEntry]
    public let sourceOnly: [RankingEntry]
}

public struct RankingEntry: Decodable, Sendable {
    public struct Coverage: Decodable, Sendable { public let known: Int; public let total: Int; public let missing: Int?; public let positive: Int? }
    public struct Row: Decodable, Sendable, Hashable {
        public let variantId: String
        public let value: Double
        public let unit: String
        public let rank: Int
        public let total: Int
        public let topPercent: Int
        public let tied: Int?
        public let estimated: Bool?
    }
    public let metricId: String
    public let coverage: Coverage
    public let rows: [Row]
}

/// One bowl as the customer configures it. Weights are edible grams per bowl.
public struct BowlItem: Codable, Sendable, Hashable {
    public var variantId: String
    public var grams: Double
    public init(variantId: String, grams: Double) { self.variantId = variantId; self.grams = grams }
}

public struct SauceChoice: Codable, Sendable, Hashable {
    public var id: String
    public var grams: Double
    public init(id: String, grams: Double) { self.id = id; self.grams = grams }
}

public struct BowlRecipe: Codable, Sendable, Hashable {
    public var items: [BowlItem]
    public var sauce: SauceChoice?
    public init(items: [BowlItem], sauce: SauceChoice? = nil) { self.items = items; self.sauce = sauce }

    public init(recipe: Recipe) {
        // Menu recipes are one-bowl formulations; scale defensively if a recipe lists more servings.
        let s = max(recipe.servings, 1)
        self.items = recipe.items.map { BowlItem(variantId: $0.variantId, grams: $0.edibleGrams / s) }
        self.sauce = nil
    }

    public func grams(of variantId: String) -> Double { items.first { $0.variantId == variantId }?.grams ?? 0 }
}
