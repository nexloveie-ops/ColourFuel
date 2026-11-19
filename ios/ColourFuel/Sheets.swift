import SwiftUI
import ColourFuelKit

/// Tap a food: drag its standard portions, see what the portion gives and how it differs from the original.
struct FoodSheet: View {
    let session: BowlSession
    let variantId: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let food = session.food(variantId), let standard = session.standard(variantId) {
            let count = session.count(variantId)
            let grams = session.current.grams(of: variantId)
            let before = session.originalGrams(variantId)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        RemoteImage(path: session.catalog.photo(for: variantId)).frame(width: 60, height: 60).clipShape(Circle())
                            .overlay(Circle().stroke(CF.ink, lineWidth: 2))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(food.nameEn).font(CF.display(22)).foregroundStyle(CF.ink)
                            Text("\(CF.stateLabel(food.state)) · 1 portion = \(CF.number(standard.grams)) g\(standard.step < 1 ? " · half portions" : "")\(standard.suggestedOnly ? " · suggested standard" : "")")
                                .font(.footnote).foregroundStyle(CF.muted)
                        }
                    }
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(CF.number(count, digits: 2)) portion\(abs(count - 1) < 1e-9 ? "" : "s")")
                            .font(CF.display(32)).foregroundStyle(CF.blue).contentTransition(.numericText())
                        Spacer()
                        Text("\(CF.number(grams)) g / bowl").font(.system(size: 18, weight: .heavy)).foregroundStyle(CF.purple)
                            .contentTransition(.numericText())
                    }
                    .animation(.snappy, value: grams)
                    Slider(value: Binding(get: { session.count(variantId) }, set: { session.setCount(variantId, $0) }),
                           in: standard.min...standard.max, step: standard.step) {
                        Text("\(food.nameEn) portions")
                    } minimumValueLabel: { Text("0").font(.caption) } maximumValueLabel: { Text(CF.number(standard.max, digits: 0)).font(.caption) }
                        .tint(CF.blue)
                        .sensoryFeedback(.selection, trigger: grams)
                        .accessibilityValue("\(CF.number(count, digits: 2)) portions, \(CF.number(grams)) grams")
                    Text("Original: \(CF.number(before)) g · Demo extra portion +\(CF.euro(DemoPricing.extraCents(for: variantId))) · DEMO ONLY")
                        .font(.caption).foregroundStyle(CF.muted)
                    PortionNutrition(session: session, variantId: variantId, grams: grams, before: before)
                    Text("Standard portions are kitchen test units, not a dietary recommendation. Raw and cooked records are separate.")
                        .font(.caption).foregroundStyle(CF.muted)
                }
                .padding(20)
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 10) {
                    Button(role: .destructive) { session.remove(variantId); dismiss() } label: {
                        Text("Remove").font(.system(size: 16, weight: .heavy)).foregroundStyle(CF.red)
                            .padding(.horizontal, 20).frame(minHeight: 52)
                            .overlay(Capsule().stroke(CF.red, lineWidth: 2))
                    }
                    Button("Done") { dismiss() }.buttonStyle(PopButtonStyle())
                }
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 6)
                .background(.regularMaterial)
            }
        }
    }
}

/// "This portion gives" and "vs Original" for one ingredient, from the same engine as the bowl totals.
struct PortionNutrition: View {
    let session: BowlSession
    let variantId: String
    let grams: Double
    let before: Double

    private let macros: [(String, String, Int)] = [("energy_reported", "kcal", 0), ("protein", "protein", 1), ("carbohydrate_by_difference", "carbs", 1), ("fat", "fat", 1), ("fibre_total_dietary", "fibre", 1)]

    var body: some View {
        let now = NutritionEngine.single(variantId, grams: grams, catalog: session.catalog)
        let was = NutritionEngine.single(variantId, grams: before, catalog: session.catalog)
        VStack(alignment: .leading, spacing: 10) {
            Text("THIS PORTION GIVES").font(.system(size: 11, weight: .heavy)).kerning(0.8).foregroundStyle(CF.purple)
            if let now {
                FlowLayout(spacing: 6) {
                    ForEach(macros, id: \.0) { id, label, digits in
                        chip(now.value(id).map { "\(CF.number($0, digits: digits))\(id == "energy_reported" ? "" : " g")" } ?? "—", label, bg: .white, fg: CF.ink)
                    }
                    ForEach(References.highlights(now), id: \.name) { r in
                        chip("\(CF.number(r.percent, digits: 0))%", "\(r.name) \(r.kind)", bg: CF.yellowSoft, fg: CF.yellowInk)
                    }
                }
            } else {
                Text("Not in your bowl right now").font(.subheadline.weight(.semibold)).foregroundStyle(CF.ink)
            }
            if abs(grams - before) > 1e-6 {
                Text(before > 0 ? "vs Original (\(grams > before ? "+" : "−")\(CF.number(abs(grams - before))) g)" : "New vs Original")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(CF.ink)
                FlowLayout(spacing: 6) {
                    ForEach(macros, id: \.0) { id, label, digits in
                        let a = now?.value(id) ?? (now == nil ? 0 : nil), b = was?.value(id) ?? (was == nil ? 0 : nil)
                        if let a, let b, abs(a - b) >= pow(10, Double(-digits)) / 2 {
                            let d = a - b
                            Text("\(d > 0 ? "+" : "−")\(CF.number(abs(d), digits: digits))\(id == "energy_reported" ? "" : " g") \(label)")
                                .font(.system(size: 12, weight: .bold)).foregroundStyle(d > 0 ? CF.blue : CF.purple)
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(Capsule().fill(d > 0 ? CF.blueSoft : Color.white))
                                .overlay(Capsule().stroke(d > 0 ? Color(hex: 0xB9C7F5) : Color(hex: 0xD9C4F2), lineWidth: 1))
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(CF.purpleSoft))
    }

    private func chip(_ value: String, _ label: String, bg: Color, fg: Color) -> some View {
        HStack(spacing: 4) { Text(value).font(.system(size: 14, weight: .heavy)).foregroundStyle(fg); Text(label).font(.system(size: 12)).foregroundStyle(CF.muted) }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(bg))
    }
}

/// Required sauce: recommended pairings first, every sauce available. Sauce nutrition is not yet calculated.
struct SauceSheet: View {
    let session: BowlSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Choose your sauce").font(CF.display(26)).foregroundStyle(CF.ink)
                Text("Required · one portion included. Recommended pairings first; every sauce is available in this concept test.")
                    .font(.subheadline).foregroundStyle(CF.muted)
                ForEach(session.sauceOptions) { sauce in
                    let selected = session.current.sauce?.id == sauce.id
                    Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { session.choose(sauce) } } label: {
                        HStack(spacing: 12) {
                            RemoteImage(path: sauce.small ?? sauce.image).frame(width: 64, height: 48).clipShape(RoundedRectangle(cornerRadius: 10))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(sauce.name).font(.system(size: 16, weight: .bold)).foregroundStyle(CF.ink)
                                Text((sauce.pairs.contains(session.product.productId) ? "Recommended pairing" : "Alternative flavour") + ((sauce.rd ?? false) ? " · R&D candidate" : ""))
                                    .font(.caption).foregroundStyle(CF.muted)
                            }
                            Spacer()
                            Image(systemName: selected ? "largecircle.fill.circle" : "circle").font(.title2).foregroundStyle(selected ? CF.purple : CF.borderStrong)
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 16).fill(selected ? CF.yellowSoft : Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(selected ? CF.purple : CF.border, lineWidth: selected ? 2 : 1.5))
                    }
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
                if let sauce = session.sauce {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("\(CF.number(session.sauceCount, digits: 0)) portion\(session.sauceCount == 1 ? "" : "s")").font(.system(size: 18, weight: .heavy)).foregroundStyle(CF.blue)
                            Spacer()
                            Text("\(CF.number(session.current.sauce?.grams ?? 0)) g").font(.system(size: 16, weight: .heavy)).foregroundStyle(CF.purple)
                        }
                        Slider(value: Binding(get: { session.sauceCount }, set: { session.setSauceCount($0) }), in: 1...3, step: 1) { Text("Sauce portions") }
                            .tint(CF.blue).sensoryFeedback(.selection, trigger: session.sauceCount)
                        Text("1 portion = \(CF.number(sauce.defaultGrams)) g. Demo: extra portions +€0.50 each. Sauce nutrition is still being calculated and is never counted as zero.")
                            .font(.caption).foregroundStyle(CF.muted)
                        Text("Draft ingredients: \(sauce.ingredients.joined(separator: " · "))").font(.caption).foregroundStyle(CF.ink)
                        if let review = sauce.review { Text(review).font(.caption).foregroundStyle(CF.muted) }
                    }
                    .padding(14).background(RoundedRectangle(cornerRadius: 16).fill(CF.blueSoft))
                }
                Button("Done") { dismiss() }.buttonStyle(PopButtonStyle()).disabled(session.sauce == nil).opacity(session.sauce == nil ? 0.5 : 1)
            }
            .padding(20)
        }
    }
}

/// Add a food: food-group chips, then photo tiles. One tap adds one standard portion.
struct AddFoodSheet: View {
    let session: BowlSession
    @State private var group: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let available = session.catalog.ingredients.filter { food in !session.current.items.contains { $0.variantId == food.variantId } }
        let groups = FoodGroups.addOnGroups(available)
        let active = groups.first { $0.label == group } ?? groups.first
        VStack(alignment: .leading, spacing: 12) {
            Text("Add a food").font(CF.display(26)).foregroundStyle(CF.ink).padding(.horizontal, 20).padding(.top, 20)
            Text("Pick a food group, then tap a food to add one standard portion.").font(.subheadline).foregroundStyle(CF.muted).padding(.horizontal, 20)
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(groups, id: \.label) { g in
                        Button { group = g.label } label: { Pill(text: "\(g.label) \(g.items.count)", selected: g.label == active?.label) }
                    }
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12, alignment: .top), GridItem(.flexible(), spacing: 12, alignment: .top)], spacing: 12) {
                    ForEach(active?.items ?? []) { food in
                        let s = Portions.standard(for: food)
                        Button { session.add(food.variantId); dismiss() } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Color.clear.frame(maxWidth: .infinity).frame(height: 110).overlay(RemoteImage(path: session.catalog.photo(for: food.variantId))).clipped()
                                    .overlay(alignment: .bottomTrailing) {
                                        Image(systemName: "plus").font(.system(size: 14, weight: .heavy)).foregroundStyle(.white)
                                            .frame(width: 30, height: 30).background(Circle().fill(CF.blue)).padding(8)
                                    }
                                Text(food.nameEn).font(.system(size: 14, weight: .bold)).foregroundStyle(CF.ink).lineLimit(2).padding(.horizontal, 10)
                                Text("\(CF.stateLabel(food.state)) · \(CF.number(s.grams)) g").font(.caption).foregroundStyle(CF.muted).padding(.horizontal, 10).padding(.bottom, 10)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(CF.border, lineWidth: 1.5))
                        }
                        .accessibilityLabel("Add \(food.nameEn), \(CF.stateLabel(food.state)), \(CF.number(s.grams)) grams")
                    }
                }
                .padding(20)
                Text("Bowl add-ons only: raw meat and fish, sauces and condiments, and foods that need cooking stay in the ingredient library.")
                    .font(.caption).foregroundStyle(CF.muted).padding(.horizontal, 20).padding(.bottom, 20)
            }
        }
    }
}

/// Base-ingredient nutrition for the bowl with adult label references. Excludes the unquantified sauce.
struct NutritionSheet: View {
    let session: BowlSession
    private let rows: [(String, String)] = [("energy_reported", "Energy"), ("protein", "Protein"), ("carbohydrate_by_difference", "Carbohydrate"), ("sugars_total", "Sugars"), ("fat", "Fat"), ("saturated_fat", "Saturates"), ("fibre_total_dietary", "Fibre"), ("salt", "Salt")]

    var body: some View {
        let n = session.nutrition, o = session.originalNutrition
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Know your bowl").font(CF.display(26)).foregroundStyle(CF.ink)
                HStack(spacing: 16) {
                    MacroRing(nutrition: n, size: 112, onDark: false)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(session.product.name).font(.system(size: 18, weight: .heavy))
                        Text("\(CF.number(session.bowlGrams)) g per bowl\(session.sauce.map { " · with \($0.name)" } ?? "")").font(.footnote).foregroundStyle(CF.muted)
                        Text("Base ingredients only · excludes sauce").font(.footnote.weight(.semibold)).foregroundStyle(CF.purple)
                    }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 22).fill(Color.white))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(CF.ink, lineWidth: 1.5))
                .background(RoundedRectangle(cornerRadius: 22).fill(CF.yellow).offset(x: 6, y: 7))
                ForEach(rows, id: \.0) { id, label in
                    let m = n.metrics[id]
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(label).font(.system(size: 15, weight: .bold))
                            Spacer()
                            if let v = m?.perServing, m?.status == .complete {
                                Text("\(CF.number(v, digits: id == "energy_reported" ? 0 : 1)) \(m?.unit ?? "")").font(.system(size: 15, weight: .heavy))
                                if let b = o.value(id), abs(v - b) > 0.05 {
                                    Text("\(v > b ? "+" : "−")\(CF.number(abs(v - b), digits: 1))").font(.caption.weight(.bold)).foregroundStyle(v > b ? CF.blue : CF.purple)
                                }
                            } else {
                                Text("Not fully quantified").font(.caption).foregroundStyle(CF.muted)
                            }
                        }
                        if let v = m?.perServing, m?.status == .complete, let r = References.context(id, value: v, unit: m?.unit ?? "") {
                            HStack {
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(CF.track)
                                        Capsule().fill(r.watch ? Color(hex: 0x8A6D12) : CF.purple).frame(width: geo.size.width * min(r.percent, 100) / 100)
                                    }
                                }
                                .frame(height: 7)
                                Text("\(CF.number(r.percent, digits: 0))% \(r.kind)\(r.watch ? " · not a target" : "")").font(.caption2.weight(.bold)).foregroundStyle(CF.muted)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                    Divider()
                }
                Text("Adult reference intakes (RI/NRV; fibre: EFSA adequate intake) are label comparisons, not daily minimums or a personal target. Sauce nutrition is still being calculated, so full-bowl totals are not shown. Concept preview, not medical advice.")
                    .font(.caption).foregroundStyle(CF.muted)
            }
            .padding(20)
        }
    }
}

/// Simple wrapping layout for chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += row + spacing; row = 0 }
            x += size.width + spacing; row = max(row, size.height); maxX = max(maxX, x)
        }
        return CGSize(width: min(maxX, width), height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += row + spacing; row = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing; row = max(row, size.height)
        }
    }
}
