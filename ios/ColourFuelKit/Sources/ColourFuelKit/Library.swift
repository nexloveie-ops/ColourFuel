import Foundation

/// Ingredient-library rules ported from nutrition-context.mjs and nutrient-explorer.mjs.
/// Rankings come from the database; the app only reads them. They describe this library, not all foods.
public enum Library {
    /// Per-100-g values of one food from the same engine as the bowls.
    public static func per100g(_ food: Ingredient, catalog: Catalog) -> NutritionResult? {
        NutritionEngine.single(food.variantId, grams: 100, catalog: catalog)
    }

    /// "Vitamin C · 111.5% NRV / 100 g": the headline adult-reference highlight (protein/fibre first when ≥15%).
    public static func quickLook(_ food: Ingredient, catalog: Catalog) -> String {
        guard let r = per100g(food, catalog: catalog) else { return "Source detail & nutrition context" }
        let daily = r.metrics.values.filter { $0.id != "energy_reported" && $0.status == .complete }
            .compactMap { m -> (String, ReferenceContext)? in References.context(m.id, value: m.perServing ?? 0, unit: m.unit).map { (m.id, $0) } }
        let rankedAll = daily.filter { !$0.1.watch && ($0.1.percent > 0) }.sorted { $0.1.percent > $1.1.percent }
        let ranked = rankedAll.filter { !References.lessFamiliar.contains($0.0) } + rankedAll.filter { References.lessFamiliar.contains($0.0) }
        let priority = ["protein", "fibre_total_dietary"].compactMap { id in ranked.first { $0.0 == id && $0.1.percent >= 15 } }
        let ordered = priority + ranked.filter { r in !priority.contains { $0.0 == r.0 } }
        if let top = ordered.first { return "\(top.1.name) · \(format(top.1.percent))% \(top.1.kind) / 100 g" }
        if let water = r.value("water") { return "Water · \(format(water)) g / 100 g" }
        return "Source detail & nutrition context"
    }

    static let highlightIds = ["protein", "fibre_total_dietary", "vitamin_c", "calcium", "iron", "magnesium", "potassium", "zinc", "copper", "manganese", "selenium", "iodine", "chloride", "biotin", "thiamin", "riboflavin", "niacin", "pantothenic_acid", "vitamin_b6", "vitamin_b12", "vitamin_k1", "folate_total", "phosphorus"]
    static let summaryExcluded: Set<String> = ["chloride", "biotin", "pantothenic_acid", "iodine"]

    public struct RankHighlight: Sendable, Hashable { public let metricId: String; public let row: RankingEntry.Row }

    public static func entries(_ catalog: Catalog, includeEstimates: Bool) -> [String: RankingEntry] {
        let list = includeEstimates ? catalog.nutrientRankings?.withEstimates : catalog.nutrientRankings?.sourceOnly
        return Dictionary((list ?? []).map { ($0.metricId, $0) }, uniquingKeysWith: { a, _ in a })
    }

    /// Up to three strongest library positions (value > 0, at least ten comparable records).
    public static func rankHighlights(_ food: Ingredient, entries: [String: RankingEntry]) -> [RankHighlight] {
        highlightIds.compactMap { id in entries[id]?.rows.first { $0.variantId == food.variantId }.map { RankHighlight(metricId: id, row: $0) } }
            .filter { $0.row.value > 0 && $0.row.total >= 10 }
            .sorted { ($0.row.topPercent, highlightIds.firstIndex(of: $0.metricId) ?? 0) < ($1.row.topPercent, highlightIds.firstIndex(of: $1.metricId) ?? 0) }
            .prefix(3).map { $0 }
    }

    /// Card badge: a familiar nutrient with a broad comparison pool, shown only when in the top 25%.
    public static func rankSummary(_ food: Ingredient, entries: [String: RankingEntry]) -> RankHighlight? {
        let size = entries.values.map(\.coverage.total).max() ?? 0
        guard let h = rankHighlights(food, entries: entries).first(where: { !summaryExcluded.contains($0.metricId) && (size == 0 || Double($0.row.total) >= Double(size) / 2) }),
              h.row.topPercent <= 25 else { return nil }
        return h
    }

    public static func rankLabel(_ row: RankingEntry.Row) -> String {
        row.total >= 10 && row.value > 0 && row.topPercent <= 25 ? "Top \(row.topPercent)% in this library" : "Rank \(row.rank) of \(row.total) in this library"
    }

    public static func format(_ v: Double) -> String {
        let f = NumberFormatter(); f.maximumFractionDigits = 1; f.minimumFractionDigits = 0; f.locale = Locale(identifier: "en_IE")
        return f.string(from: NSNumber(value: v)) ?? String(v)
    }
}
