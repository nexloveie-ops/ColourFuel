import Foundation

/// Response of `POST /api/photo-estimate`. The server only returns foods and estimated grams;
/// nutrition is always calculated here from the library records.
public struct PhotoEstimate: Decodable, Sendable, Hashable {
    public struct Food: Decodable, Sendable, Hashable, Identifiable {
        public let label: String
        public let variantId: String?
        public let grams: Double
        public let confidence: String
        /// library · library_photo_added · added_usda · added_pack_label · not_found
        public let source: String?
        public var id: String { (variantId ?? "none") + "|" + label }
        public init(label: String, variantId: String?, grams: Double, confidence: String, source: String? = nil) {
            self.label = label; self.variantId = variantId; self.grams = grams; self.confidence = confidence; self.source = source
        }
        public var addedNow: Bool { source == "added_usda" || source == "added_pack_label" }
    }
    public let estimateOnly: Bool
    public let isFoodPhoto: Bool
    public let foods: [Food]
    public let sauceOrDressingVisible: Bool
    public let note: String
    /// Full library records of every matched food (includes foods added from photos after the app loaded).
    public let foodRecords: [Ingredient]?

    public static func decode(_ data: Data) throws -> PhotoEstimate {
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(PhotoEstimate.self, from: data)
    }

    /// Foods the library can back, in photo order.
    public var matched: [Food] { foods.filter { $0.variantId != nil } }
    /// Foods seen but not in the library: shown, never counted.
    public var unmatched: [Food] { foods.filter { $0.variantId == nil } }

    /// A recipe of the matched foods at the customer's adjusted weights (grams by variant id).
    public func recipe(grams: [String: Double], catalog: Catalog) -> BowlRecipe {
        BowlRecipe(items: matched.compactMap { f in
            guard let id = f.variantId, catalog.ingredient(id) != nil else { return nil }
            let g = max(0, grams[id] ?? f.grams)
            return g > 0 ? BowlItem(variantId: id, grams: g) : nil
        })
    }
}
