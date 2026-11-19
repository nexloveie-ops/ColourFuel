import Foundation

/// Port of portion-standards.mjs (standard-portions-v2): proposed kitchen-test units, not validated specifications.
public struct PortionStandard: Sendable, Hashable {
    public let grams: Double
    public let step: Double
    public let min: Double
    public let max: Double
    public let suggestedOnly: Bool
}

public enum Portions {
    public static let version = "standard-portions-v2"
    static let proteins = ["chicken-breast--roasted", "tuna--cooked", "pork-shavings--cooked", "atlantic-salmon--cooked", "chickpea--boiled", "edamame--cooked"]
    static let vegetables = ["broccoli--raw", "carrot--raw", "red-pepper--raw", "tomato--raw", "cucumber--raw", "purple-cabbage--raw", "sweetcorn--cooked"]
    static let known: [String: PortionStandard] = {
        var t: [String: PortionStandard] = [:]
        func def(_ g: Double, _ step: Double = 1) -> PortionStandard { PortionStandard(grams: g, step: step, min: 0, max: 4, suggestedOnly: false) }
        for id in proteins + vegetables { t[id] = def(50) }
        for id in ["brown-rice--cooked", "quinoa--cooked"] { t[id] = def(50, 0.5) }
        t["spinach--raw"] = def(25); t["feta--ready_to_eat"] = def(25)
        t["spring-onion--raw"] = def(10); t["sesame-seed--toasted"] = def(5); t["olive-oil--ready_to_use"] = def(5)
        return t
    }()

    public static func standard(for food: Ingredient) -> PortionStandard {
        if let s = known[food.variantId] { return s }
        let small = ["oil", "spice", "seed", "herb", "condiment"].contains(food.category)
        return PortionStandard(grams: small ? 5 : 50, step: 1, min: 0, max: 4, suggestedOnly: true)
    }

    public static func sauceStandard(_ sauce: Sauce) -> PortionStandard {
        PortionStandard(grams: sauce.defaultGrams, step: 1, min: 1, max: 3, suggestedOnly: false)
    }

    public static func count(grams: Double, _ s: PortionStandard) -> Double { grams / s.grams }

    /// Grams for a whole/half portion count, to 0.1 g.
    public static func grams(count: Double, _ s: PortionStandard) -> Double { (count * s.grams * 10).rounded() / 10 }

    public static func isStandard(_ count: Double, _ s: PortionStandard) -> Bool {
        count.isFinite && count >= s.min && count <= s.max && abs(count / s.step - (count / s.step).rounded()) < 1e-7
    }
}

/// Owner-authorised DEMO charges (invented interaction-test amounts; real costs are not set). Never a quote.
public struct PriceLine: Sendable, Hashable {
    public let id: String
    public let delta: Double
    public let amountCents: Int
}

public enum DemoPricing {
    static let extraCents: [String: Int] = {
        var t: [String: Int] = [
            "chicken-breast--roasted": 150, "atlantic-salmon--cooked": 200, "tuna--cooked": 150, "pork-shavings--cooked": 175,
            "chickpea--boiled": 50, "edamame--cooked": 75, "brown-rice--cooked": 50, "quinoa--cooked": 60,
            "spinach--raw": 30, "feta--ready_to_eat": 75, "spring-onion--raw": 10, "sesame-seed--toasted": 15, "olive-oil--ready_to_use": 10
        ]
        for id in Portions.vegetables { t[id] = 40 }
        return t
    }()
    public static let extraSauceCents = 50
    public static func extraCents(for variantId: String) -> Int { extraCents[variantId] ?? 50 }

    /// Base target price + charges for portions above the original; first sauce portion included; no removal discount.
    public static func price(original: BowlRecipe, current: BowlRecipe, catalog: Catalog, baseCents: Int) -> (totalCents: Int, lines: [PriceLine]) {
        var adjustment = 0
        var lines: [PriceLine] = []
        var ids: [String] = []
        for id in original.items.map(\.variantId) + current.items.map(\.variantId) where !ids.contains(id) { ids.append(id) }
        for id in ids {
            guard let food = catalog.ingredient(id) else { continue }
            let s = Portions.standard(for: food)
            let delta = current.grams(of: id) / s.grams - original.grams(of: id) / s.grams
            guard abs(delta) >= 1e-7 else { continue }
            let rate = delta > 0 ? extraCents(for: id) : 0
            let amount = Int((delta * Double(rate)).rounded())
            adjustment += amount
            lines.append(PriceLine(id: id, delta: delta, amountCents: amount))
        }
        if let choice = current.sauce, let sauce = catalog.sauce(choice.id) {
            let delta = choice.grams / Portions.sauceStandard(sauce).grams - 1
            if abs(delta) >= 1e-7 {
                let amount = Int((delta * Double(delta > 0 ? extraSauceCents : 0)).rounded())
                adjustment += amount
                lines.append(PriceLine(id: "sauce:" + sauce.id, delta: delta, amountCents: amount))
            }
        }
        return (max(0, baseCents + adjustment), lines)
    }
}

/// Food groups and Bowl add-on rules (port of ingredient-library.mjs).
public enum FoodGroups {
    public static let groups: [(id: String, label: String, categories: [String])] = [
        ("vegetables", "Vegetables", ["vegetable"]), ("fruit", "Fruit & juices", ["fruit"]), ("grains", "Grains", ["grain"]),
        ("plant-protein", "Beans & tofu", ["pulse", "soy"]), ("animal-protein", "Meat, fish & eggs", ["meat", "fish", "egg"]),
        ("dairy", "Dairy", ["dairy"]), ("nuts-seeds", "Nuts & seeds", ["nut", "seed"]), ("herbs-spices", "Herbs & spices", ["herb", "spice"]),
        ("pantry", "Oils, sauces & pantry", ["oil", "sauce", "sweetener", "water"])
    ]
    public static func group(of food: Ingredient) -> String {
        if food.ingredientId == "chipotle" { return "herbs-spices" }
        if food.ingredientId == "tahini" { return "pantry" }
        return groups.first { $0.categories.contains(food.category) }?.id ?? "pantry"
    }
    static let needsCooking: Set<String> = ["potato", "sweet-potato", "aubergine", "butternut-squash", "parsnip", "swede", "leek"]
    static let libraryOnly: Set<String> = ["lemon-juice", "orange-juice", "lime-juice", "tahini", "whole-milk", "buttermilk"]

    /// Foods a customer can sensibly add to a ready Bowl in their listed state.
    public static func isBowlAddOn(_ food: Ingredient) -> Bool {
        if ["sauce", "sweetener", "water", "spice"].contains(food.category) { return false }
        if ["meat", "fish", "egg"].contains(food.category) && food.state == "raw" { return false }
        if food.category == "grain" && food.state == "dry" { return false }
        if needsCooking.contains(food.ingredientId) && food.state == "raw" { return false }
        return !libraryOnly.contains(food.ingredientId)
    }

    public static func addOnGroups(_ foods: [Ingredient]) -> [(label: String, items: [Ingredient])] {
        groups.map { g in (g.label, foods.filter { group(of: $0) == g.id && isBowlAddOn($0) }.sorted { $0.nameEn < $1.nameEn }) }
            .filter { !$0.items.isEmpty }
    }
}
