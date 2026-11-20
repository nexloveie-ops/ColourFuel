import SwiftUI
import ColourFuelKit

/// Ingredient library: browse by ingredient or by nutrient, then open a food. Rankings come from the database
/// and describe this library only, not all foods.
struct LibraryScreen: View {
    let session: BowlSession
    @Environment(\.dismiss) private var dismiss
    @State private var mode = 0
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                Picker("View", selection: $mode) {
                    Text("By ingredient").tag(0)
                    Text("By nutrient").tag(1)
                }
                .pickerStyle(.segmented).padding(.horizontal, 20).padding(.vertical, 10)
                if mode == 0 { IngredientBrowser(catalog: session.catalog) } else { NutrientBrowser(catalog: session.catalog) }
            }
            .navigationTitle("Ingredients")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.fontWeight(.bold) } }
            .navigationDestination(for: String.self) { id in
                if let food = session.catalog.ingredient(id) { IngredientDetail(session: session, food: food) }
            }
        }
        .tint(CF.blue)
    }
}

struct IngredientBrowser: View {
    let catalog: Catalog
    @State private var query = ""
    @State private var group = "all"
    @State private var retailer = "all"

    var body: some View {
        let entries = Library.entries(catalog, includeEstimates: true)
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let searched = catalog.ingredients.filter { food in
            (q.isEmpty || food.nameEn.lowercased().contains(q)) &&
            (retailer == "all" || catalog.buying(for: food).contains { $0.retailerId == retailer })
        }
        let shown = searched.filter { group == "all" || FoodGroups.group(of: $0) == group }.sorted { $0.nameEn < $1.nameEn }
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("\(catalog.ingredients.count) foods in a growing library · not every food sold in Ireland. Buying links are researched listings, not live stock.")
                    .font(.footnote).foregroundStyle(CF.muted).padding(.horizontal, 20)
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        Button { group = "all" } label: { Pill(text: "All \(searched.count)", selected: group == "all") }
                        ForEach(FoodGroups.groups, id: \.id) { g in
                            let n = searched.filter { FoodGroups.group(of: $0) == g.id }.count
                            if n > 0 { Button { group = g.id } label: { Pill(text: "\(g.label) \(n)", selected: group == g.id) } }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)
                Menu {
                    Picker("Retailer", selection: $retailer) {
                        Text("All researched retailers").tag("all")
                        ForEach(catalog.irishRetailers) { Text($0.name).tag($0.id) }
                    }
                } label: {
                    Label(retailer == "all" ? "Buying references: all retailers" : "At \(catalog.retailer(retailer)?.name ?? retailer)", systemImage: "cart")
                        .font(.subheadline.weight(.semibold))
                }
                .padding(.horizontal, 20)
                if shown.isEmpty {
                    VStack(spacing: 10) {
                        Text("No foods match these filters.").font(.headline)
                        Button("Clear search and filters") { query = ""; group = "all"; retailer = "all" }
                    }
                    .frame(maxWidth: .infinity).padding(.top, 40)
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12, alignment: .top), GridItem(.flexible(), spacing: 12, alignment: .top)], spacing: 12) {
                    ForEach(shown) { food in
                        NavigationLink(value: food.variantId) { IngredientCard(catalog: catalog, food: food, entries: entries) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 30)
            }
        }
        .searchable(text: $query, prompt: "Search foods")
    }
}

struct IngredientCard: View {
    let catalog: Catalog
    let food: Ingredient
    let entries: [String: RankingEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Color.clear.frame(maxWidth: .infinity).frame(height: 116)
                .overlay(RemoteImage(path: catalog.photo(for: food.variantId))).clipped()
            VStack(alignment: .leading, spacing: 4) {
                // Every slot keeps its space so all cards in the grid are the same size.
                Text(food.nameEn).font(.system(size: 15, weight: .heavy)).foregroundStyle(CF.ink).lineLimit(1).minimumScaleFactor(0.8)
                Text("\(CF.stateLabel(food.state)) · \(sourceLabel(food))").font(.caption2).foregroundStyle(CF.muted).lineLimit(1)
                Text(Library.quickLook(food, catalog: catalog)).font(.caption.weight(.semibold)).foregroundStyle(CF.blue).lineLimit(2, reservesSpace: true)
                let rank = Library.rankSummary(food, entries: entries)
                Text(rank.map { "\(catalog.metric($0.metricId)?.nameEn ?? $0.metricId) · Top \($0.row.topPercent)%" } ?? "Top")
                    .font(.caption2.weight(.bold)).foregroundStyle(Color(hex: 0x6A4191)).lineLimit(1).minimumScaleFactor(0.75)
                    .padding(.horizontal, 7).padding(.vertical, 4).background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0xF3EEFF)))
                    .opacity(rank == nil ? 0 : 1).accessibilityHidden(rank == nil)
            }
            .padding(.horizontal, 10).padding(.bottom, 10)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 18).fill(.white))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(CF.border, lineWidth: 1.5))
        .accessibilityElement(children: .combine)
    }
}

func sourceLabel(_ food: Ingredient) -> String {
    let id = food.datasetId ?? ""
    let base = id == "photo_pack_label" ? "Pack label" : id.hasPrefix("usda") ? "USDA" : id.hasPrefix("supplier") ? "Manufacturer" : "CoFID"
    return base + (food.verificationStatus == "reference_estimate" ? " · reference estimate" : "")
}

/// Choose a nutrient, see foods ranked by concentration per 100 g (database ranks, ties shared).
struct NutrientBrowser: View {
    let catalog: Catalog
    @State private var metricId = "vitamin_c"
    @State private var includeEstimates = true
    private let featured = ["protein", "fibre_total_dietary", "vitamin_c", "iron", "calcium", "potassium", "magnesium", "vitamin_k1", "folate_total", "zinc", "vitamin_b6"]

    var body: some View {
        let entries = Library.entries(catalog, includeEstimates: includeEstimates)
        let entry = entries[metricId]
        let rows = (entry?.rows ?? []).sorted { ($0.rank, $0.variantId) < ($1.rank, $1.variantId) }
        let maxValue = rows.map(\.value).max() ?? 1
        let unit = catalog.metric(metricId)?.unit ?? ""
        let others = catalog.metrics.map(\.metricId).filter { !featured.contains($0) && $0 != "water" }
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(featured, id: \.self) { id in
                            Button { metricId = id } label: { Pill(text: catalog.metric(id)?.nameEn ?? id, selected: metricId == id) }
                        }
                        Menu {
                            ForEach(others, id: \.self) { id in Button(catalog.metric(id)?.nameEn ?? id) { metricId = id } }
                        } label: { Pill(text: "All \(catalog.metrics.count)…", selected: !featured.contains(metricId)) }
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)
                Toggle(isOn: $includeEstimates) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Include reference estimates").font(.subheadline.weight(.semibold))
                        Text("\(entry?.coverage.known ?? 0) comparable foods · per 100 g · ranks within this library, not all foods").font(.caption).foregroundStyle(CF.muted)
                    }
                }
                .tint(CF.blue)
                .padding(12).background(RoundedRectangle(cornerRadius: 14).fill(CF.purpleSoft)).padding(.horizontal, 20)
                LazyVStack(spacing: 0) {
                    ForEach(rows, id: \.variantId) { row in
                        if let food = catalog.ingredient(row.variantId) {
                            NavigationLink(value: food.variantId) {
                                HStack(spacing: 10) {
                                    Text("\(row.rank)").font(.system(size: 16, weight: .black)).foregroundStyle(CF.purple).frame(width: 32, alignment: .leading)
                                    RemoteImage(path: catalog.photo(for: food.variantId)).frame(width: 46, height: 46).clipShape(RoundedRectangle(cornerRadius: 12))
                                    VStack(alignment: .leading, spacing: 5) {
                                        HStack {
                                            Text(food.nameEn).font(.system(size: 14, weight: .bold)).foregroundStyle(CF.ink).lineLimit(1)
                                            Spacer()
                                            Text("\(Library.format(row.value)) \(unit)").font(.system(size: 14, weight: .heavy)).foregroundStyle(CF.ink)
                                        }
                                        GeometryReader { geo in
                                            ZStack(alignment: .leading) {
                                                Capsule().fill(CF.track)
                                                Capsule().fill(CF.purple).frame(width: max(2, geo.size.width * row.value / maxValue))
                                            }
                                        }
                                        .frame(height: 7)
                                        Text("\(CF.stateLabel(food.state))\((row.tied ?? 1) > 1 ? " · tied" : "")\(row.estimated == true ? " · reference estimate" : "")")
                                            .font(.caption2).foregroundStyle(CF.muted)
                                    }
                                }
                                .padding(.vertical, 9)
                            }
                            .buttonStyle(.plain)
                            Divider()
                        }
                    }
                }
                .padding(.horizontal, 20)
                Text("Concentration per 100 g, not a serving recommendation or health score. Raw and cooked records are ranked separately; missing, trace and incompatible values are left out, never treated as zero.")
                    .font(.caption).foregroundStyle(CF.muted).padding(.horizontal, 20).padding(.bottom, 30)
            }
        }
    }
}

/// One food: photo and credit, library positions, per-100-g nutrition with adult references, Irish buying links.
struct IngredientDetail: View {
    let session: BowlSession
    let food: Ingredient
    @State private var showAll = false
    @State private var added = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        let catalog = session.catalog
        let r = Library.per100g(food, catalog: catalog)
        let highlights = Library.rankHighlights(food, entries: Library.entries(catalog, includeEstimates: true))
        let photo = catalog.photoRecord(for: food.variantId)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Color.clear.frame(maxWidth: .infinity).frame(height: 230).overlay(RemoteImage(path: photo?.image)).clipShape(RoundedRectangle(cornerRadius: 22))
                    Text([photo?.generated == true ? "AI illustration" : "Illustrative photo", photo?.artist, photo?.license].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption2).foregroundStyle(CF.muted)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(food.nameEn).font(CF.display(30)).foregroundStyle(CF.ink)
                    Text("\(CF.stateLabel(food.state)) · \(sourceLabel(food)) · per 100 g").font(.subheadline).foregroundStyle(CF.muted)
                    if let added = food.photoAddition {
                        HStack(spacing: 6) {
                            Label("Added from a customer photo · \(added.sourceLabel) · not yet reviewed", systemImage: "sparkles")
                                .font(.caption.weight(.semibold)).foregroundStyle(CF.purple)
                            if let url = food.sourceUrl.flatMap(URL.init(string:)) {
                                Link(destination: url) { Image(systemName: "arrow.up.right.square") }.font(.caption.weight(.bold)).accessibilityLabel("Open the source record")
                            }
                        }
                        .padding(.top, 2)
                    }
                }
                if !highlights.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 10) {
                            ForEach(highlights, id: \.metricId) { h in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text((catalog.metric(h.metricId)?.nameEn ?? h.metricId).uppercased()).font(.system(size: 11, weight: .heavy)).foregroundStyle(Color(hex: 0xE9DCFB))
                                    Text(h.row.topPercent <= 25 ? "Top \(h.row.topPercent)%" : "Rank \(h.row.rank)").font(.system(size: 22, weight: .black)).foregroundStyle(.white)
                                    Text("#\(h.row.rank) of \(h.row.total) in this library").font(.caption2).foregroundStyle(Color(hex: 0xE9DCFB))
                                }
                                .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(CF.purple))
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                    .contentMargins(.horizontal, 20, for: .scrollContent)
                    .padding(.horizontal, -20)
                }
                if let r {
                    HStack(spacing: 6) {
                        ForEach([("energy_reported", "kcal", 0), ("protein", "protein g", 1), ("carbohydrate_by_difference", "carbs g", 1), ("fat", "fat g", 1), ("fibre_total_dietary", "fibre g", 1)], id: \.0) { id, label, d in
                            VStack(spacing: 2) {
                                Text(r.value(id).map { CF.number($0, digits: d) } ?? "—").font(.system(size: 16, weight: .black))
                                Text(label).font(.caption2).foregroundStyle(CF.muted)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 9)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(CF.border, lineWidth: 1.5))
                        }
                    }
                    let contexts = r.metrics.values.filter { $0.status == .complete && ($0.perServing ?? 0) > 0 }
                        .compactMap { m in References.context(m.id, value: m.perServing ?? 0, unit: m.unit).map { (m, $0) } }
                        .filter { !["energy_reported"].contains($0.0.id) }
                        .sorted { $0.1.percent > $1.1.percent }
                    VStack(alignment: .leading, spacing: 10) {
                        Text("ADULT REFERENCE · PER 100 G").font(.system(size: 11, weight: .heavy)).kerning(0.8).foregroundStyle(CF.blue)
                        ForEach(Array(contexts.prefix(showAll ? contexts.count : 5)), id: \.0.id) { m, c in
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text("\(c.name) · \(CF.number(m.perServing ?? 0, digits: 2)) \(m.unit)").font(.footnote.weight(.semibold))
                                    Spacer()
                                    Text("\(CF.number(c.percent))% \(c.kind)\(c.watch ? " · not a target" : "")").font(.caption.weight(.bold)).foregroundStyle(c.watch ? CF.yellowInk : CF.blue)
                                }
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(Color(hex: 0xDFE6FF))
                                        Capsule().fill(c.watch ? Color(hex: 0x8A6D12) : CF.blue).frame(width: geo.size.width * min(c.percent, 100) / 100)
                                    }
                                }
                                .frame(height: 7)
                            }
                        }
                        if contexts.count > 5 {
                            Button(showAll ? "Show fewer" : "Show all \(contexts.count) with a reference") { withAnimation { showAll.toggle() } }.font(.footnote.weight(.bold))
                        }
                        Text("Label comparisons, not daily minimums or a personal target. Nutrients without a directly comparable reference are not given a percentage.")
                            .font(.caption2).foregroundStyle(CF.muted)
                    }
                    .padding(14).background(RoundedRectangle(cornerRadius: 16).fill(CF.blueSoft))
                }
                let refs = catalog.buying(for: food)
                if !refs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("BUY IN IRELAND").font(.system(size: 11, weight: .heavy)).kerning(0.8).foregroundStyle(CF.purple)
                        ForEach(refs, id: \.url) { ref in
                            Button { if let u = URL(string: ref.url) { openURL(u) } } label: {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(catalog.retailer(ref.retailerId)?.name ?? ref.retailerId) · \(ref.product ?? "Listing")").font(.footnote.weight(.semibold)).foregroundStyle(CF.ink).multilineTextAlignment(.leading)
                                        if let note = ref.note, !note.isEmpty { Text(note).font(.caption2).foregroundStyle(CF.muted).multilineTextAlignment(.leading) }
                                        if let d = ref.reviewedOn { Text("Reviewed \(d)").font(.caption2).foregroundStyle(CF.muted) }
                                    }
                                    Spacer()
                                    Text(ref.pack ?? "").font(.caption).foregroundStyle(CF.muted)
                                    Image(systemName: "arrow.up.right").font(.caption.weight(.bold)).foregroundStyle(CF.blue)
                                }
                                .padding(.vertical, 6)
                            }
                            Divider()
                        }
                        Text("Researched listings, not live stock or prices. Available in Ireland does not mean grown in Ireland.").font(.caption2).foregroundStyle(CF.muted)
                    }
                }
                if FoodGroups.isBowlAddOn(food) {
                    let inBowl = session.current.items.contains { $0.variantId == food.variantId }
                    Group {
                    if inBowl || added {
                        Label("In your \(session.product.name)", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 17, weight: .heavy)).foregroundStyle(CF.blue)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(Capsule().strokeBorder(CF.blue.opacity(0.35), lineWidth: 2))
                    } else {
                        Button("+ Add to my \(session.product.name)") { session.add(food.variantId); added = true }
                            .buttonStyle(PopButtonStyle())
                    }
                    }
                    .sensoryFeedback(.success, trigger: added)
                } else {
                    Text("Library only: raw meat and fish, sauces and condiments, and foods that need cooking aren’t Bowl add-ons.")
                        .font(.caption).foregroundStyle(CF.muted)
                }
            }
            .padding(20)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
