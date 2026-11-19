import Foundation

/// Port of `calculate()` in recipe-engine.mjs (base ingredients; Bowl sauces are unquantified and excluded).
/// Same rules: only numeric source or labelled reference values in the metric's own unit count;
/// trace and missing values make a total incomplete instead of becoming zero.
public enum MetricStatus: String, Sendable { case complete, incomplete, trace }

public struct MetricResult: Sendable, Hashable {
    public let id: String
    public let name: String
    public let unit: String
    public let status: MetricStatus
    public let total: Double?
    public let perServing: Double?
    public let references: Int
}

public struct NutritionResult: Sendable {
    public let metrics: [String: MetricResult]
    public let weight: Double
    public func value(_ id: String) -> Double? {
        guard let m = metrics[id], m.status == .complete else { return nil }
        return m.perServing
    }
}

public enum NutritionEngine {
    public static func calculate(_ recipe: BowlRecipe, catalog: Catalog) -> NutritionResult {
        let active = recipe.items.filter { $0.grams > 0 }
        var metrics: [String: MetricResult] = [:]
        for metric in catalog.metrics {
            // Six decimal places in source units × tenths of a gram, summed as integers (as the website does).
            var numerator: Int64 = 0
            var missing = 0, trace = 0, references = 0
            for item in active {
                let n = catalog.ingredient(item.variantId)?.nutrients.first { $0.metricId == metric.metricId }
                let isTrace = n?.result == "trace_retained"
                let isReference = n?.result == "reference_imputation"
                let value = isReference ? n?.filledValue : n?.primaryValue
                let valid = n?.unit == metric.unit
                    && (n?.result == "primary_numeric" || isReference)
                    && value.map { $0.isFinite && $0 >= 0 } == true
                if isTrace { trace += 1 } else if !valid { missing += 1 }
                if valid, let v = value {
                    numerator += Int64((v * 1e6).rounded()) * Int64((item.grams * 10).rounded())
                    if isReference { references += 1 }
                }
            }
            let known = Double(numerator) / 1e9
            let complete = missing == 0 && trace == 0
            metrics[metric.metricId] = MetricResult(
                id: metric.metricId, name: metric.nameEn, unit: metric.unit,
                status: complete ? .complete : (missing > 0 ? .incomplete : .trace),
                total: complete ? known : nil, perServing: complete ? known : nil, references: references)
        }
        // Salt equivalent is derived only from a complete sodium total in mg: sodium × 2.5.
        if let sodium = metrics["sodium"] {
            let complete = sodium.status == .complete && sodium.unit == "mg"
            metrics["salt"] = MetricResult(
                id: "salt", name: "Salt equivalent", unit: "g",
                status: complete ? .complete : (sodium.status == .trace ? .trace : .incomplete),
                total: complete ? sodium.total.map { $0 * 2.5 / 1000 } : nil,
                perServing: complete ? sodium.perServing.map { $0 * 2.5 / 1000 } : nil,
                references: sodium.references)
        }
        return NutritionResult(metrics: metrics, weight: active.reduce(0) { $0 + $1.grams })
    }

    /// Nutrition of one ingredient at a weight (used beside each slider).
    public static func single(_ variantId: String, grams: Double, catalog: Catalog) -> NutritionResult? {
        guard grams > 0 else { return nil }
        return calculate(BowlRecipe(items: [BowlItem(variantId: variantId, grams: grams)]), catalog: catalog)
    }
}

/// Adult label references (EU RI/NRV; EFSA fibre AI). Comparisons, not daily minimums or targets.
public struct ReferenceContext: Sendable {
    public let name: String
    public let kind: String
    public let percent: Double
    public let watch: Bool
}

public enum References {
    static let table: [String: (Double, String, String, String, Bool)] = [
        "fibre_total_dietary": (25, "g", "Dietary fibre", "AI", false),
        "energy_reported": (2000, "kcal", "Energy", "RI", false), "protein": (50, "g", "Protein", "RI", false),
        "fat": (70, "g", "Fat", "RI", true), "saturated_fat": (20, "g", "Saturates", "RI", true), "salt": (6, "g", "Salt", "RI", true),
        "calcium": (800, "mg", "Calcium", "NRV", false), "iron": (14, "mg", "Iron", "NRV", false), "magnesium": (375, "mg", "Magnesium", "NRV", false),
        "phosphorus": (700, "mg", "Phosphorus", "NRV", false), "potassium": (2000, "mg", "Potassium", "NRV", false), "zinc": (10, "mg", "Zinc", "NRV", false),
        "copper": (1, "mg", "Copper", "NRV", false), "manganese": (2, "mg", "Manganese", "NRV", false), "selenium": (55, "µg", "Selenium", "NRV", false),
        "iodine": (150, "µg", "Iodine", "NRV", false), "chloride": (800, "mg", "Chloride", "NRV", false), "biotin": (50, "µg", "Biotin", "NRV", false),
        "thiamin": (1.1, "mg", "Vitamin B1", "NRV", false), "riboflavin": (1.4, "mg", "Vitamin B2", "NRV", false), "pantothenic_acid": (6, "mg", "Pantothenic acid", "NRV", false),
        "vitamin_b6": (1.4, "mg", "Vitamin B6", "NRV", false), "vitamin_b12": (2.5, "µg", "Vitamin B12", "NRV", false), "vitamin_c": (80, "mg", "Vitamin C", "NRV", false)
    ]
    /// Less familiar nutrients are not used as headline highlights (same rule as the website).
    static let lessFamiliar: Set<String> = ["chloride", "biotin", "pantothenic_acid"]

    public static func context(_ id: String, value: Double, unit: String) -> ReferenceContext? {
        guard let r = table[id], r.1 == unit, value.isFinite, value >= 0 else { return nil }
        return ReferenceContext(name: r.2, kind: r.3, percent: value / r.0 * 100, watch: r.4)
    }

    /// Up to `limit` notable label nutrients (≥10% of the reference) for a portion, familiar ones first.
    public static func highlights(_ result: NutritionResult, limit: Int = 2) -> [ReferenceContext] {
        let skip: Set<String> = ["energy_reported", "protein", "carbohydrate_by_difference", "fat", "fibre_total_dietary", "saturated_fat", "sugars_total", "salt", "sodium", "water"]
        return result.metrics.values
            .filter { !skip.contains($0.id) && !lessFamiliar.contains($0.id) && $0.status == .complete && ($0.perServing ?? 0) > 0 }
            .compactMap { m in context(m.id, value: m.perServing ?? 0, unit: m.unit) }
            .filter { !$0.watch && $0.percent >= 10 }
            .sorted { $0.percent > $1.percent }
            .prefix(limit).map { $0 }
    }
}
