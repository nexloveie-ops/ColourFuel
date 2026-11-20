import SwiftUI
import ColourFuelKit

/// Direction 3 home: the bowl is the interface. Food photo chips sit around the bowl, sized by grams.
struct BowlStageScreen: View {
    @State var session: BowlSession
    @State private var editing: String?
    @State private var showSauce = false
    @State private var showAdd = false
    @State private var showNutrition = false
    @State private var showPassport = false
    @State private var showLibrary = false
    @State private var showPhoto = false
    @State private var swipeEdge: Edge = .trailing

    /// Horizontal swipe on the bowl or its title moves to the next or previous bowl.
    private var swipeToSwitch: some Gesture {
        DragGesture(minimumDistance: 30).onEnded { value in
            let dx = value.translation.width, dy = value.translation.height
            guard abs(dx) > 60, abs(dx) > abs(dy) * 1.6 else { return }
            let bowls = session.catalog.bowls
            guard let i = bowls.firstIndex(where: { $0.id == session.product.id }) else { return }
            let next = dx < 0 ? i + 1 : i - 1
            guard bowls.indices.contains(next) else { return }
            swipeEdge = dx < 0 ? .trailing : .leading
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { session.select(bowls[next]) }
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    bowlPicker
                    Group {
                        BowlStage(session: session, onTapFood: { editing = $0 }, onTapSauce: { showSauce = true })
                            .padding(.top, -12)
                        titleBlock
                    }
                    .id(session.product.id)
                    .transition(.push(from: swipeEdge))
                    .contentShape(Rectangle())
                    .simultaneousGesture(swipeToSwitch)
                    presetRow
                    Color.clear.frame(height: 130)
                }
            }
            .scrollIndicators(.hidden)
            dock
        }
        .background(Color.white)
        .sheet(item: Binding(get: { editing.map(Identified.init) }, set: { editing = $0?.id })) { item in
            FoodSheet(session: session, variantId: item.id).presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSauce) { SauceSheet(session: session).presentationDetents([.large]).presentationDragIndicator(.visible) }
        .sheet(isPresented: $showAdd) { AddFoodSheet(session: session).presentationDetents([.large]).presentationDragIndicator(.visible) }
        .sheet(isPresented: $showNutrition) { NutritionSheet(session: session).presentationDetents([.large]).presentationDragIndicator(.visible) }
        .fullScreenCover(isPresented: $showPassport) { PassportScreen(session: session) }
        .fullScreenCover(isPresented: $showLibrary) { LibraryScreen(session: session) }
        .fullScreenCover(isPresented: $showPhoto) { PhotoEstimateScreen(catalog: session.catalog) }
    }

    private var header: some View {
        HStack {
            RemoteImage(path: "colourfuel-horizontal.jpg").frame(width: 120, height: 40).clipped()
                .accessibilityLabel("ColourFuel")
            Spacer()
            Button { showLibrary = true } label: {
                Image(systemName: "leaf.fill").font(.system(size: 17, weight: .bold)).foregroundStyle(CF.blue)
                    .frame(width: 44, height: 44).background(Circle().fill(CF.blueSoft))
            }
            .accessibilityLabel("Ingredient library")
            Button { showPhoto = true } label: {
                Image(systemName: "camera.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(CF.purple)
                    .frame(width: 44, height: 44).background(Circle().fill(CF.purpleSoft))
            }
            .accessibilityLabel("Photo nutrition estimate")
            Text(session.isCustom ? (session.activePreset ?? "Custom mix") : "Original Recipe")
                .font(.system(size: 12, weight: .heavy))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(Capsule().fill(session.isCustom ? CF.yellow : CF.blueSoft))
                .overlay(Capsule().stroke(session.isCustom ? CF.ink : .clear, lineWidth: 1.5))
                .animation(.spring, value: session.isCustom)
        }
        .padding(.horizontal, 20).padding(.top, 8)
    }

    private var bowlPicker: some View {
        ScrollViewReader { proxy in
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(session.catalog.bowls) { bowl in
                    let selected = bowl.id == session.product.id
                    Button {
                        let bowls = session.catalog.bowls
                        let from = bowls.firstIndex { $0.id == session.product.id } ?? 0, to = bowls.firstIndex { $0.id == bowl.id } ?? 0
                        swipeEdge = to >= from ? .trailing : .leading
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { session.select(bowl) }
                    } label: {
                        Text(bowl.name + (bowl.isResearch ? " · R&D" : ""))
                            .font(.system(size: 13, weight: selected ? .bold : .semibold))
                            .foregroundStyle(selected ? Color.white : CF.ink)
                            .padding(.horizontal, 12).frame(minHeight: 36)
                            .background(Capsule().fill(selected ? CF.ink : Color.white))
                            .overlay(Capsule().stroke(selected ? CF.ink : CF.borderStrong, lineWidth: 1.5))
                    }
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .id(bowl.id)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
        .onChange(of: session.product.id) { _, id in withAnimation(.snappy) { proxy.scrollTo(id, anchor: .center) } }
        }
    }

    private var titleBlock: some View {
        VStack(spacing: 6) {
            Text(session.product.name).font(CF.display(28)).foregroundStyle(CF.ink)
            Text(session.product.isResearch ? "In the test kitchen · not available to order" : "Concept preview · not yet available to order")
                .font(.footnote).foregroundStyle(CF.muted)
            Text("Tap a food to adjust · swipe for more bowls").font(.subheadline).lineLimit(1).minimumScaleFactor(0.85).foregroundStyle(CF.muted)
            Button { showAdd = true } label: {
                Label("Add a food", systemImage: "plus.circle.fill").font(.system(size: 15, weight: .bold))
                    .padding(.horizontal, 16).frame(minHeight: 44)
                    .overlay(Capsule().stroke(CF.blue, lineWidth: 2))
            }
            .padding(.top, 6)
        }
        .padding(.top, 2).padding(.horizontal, 20)
        .multilineTextAlignment(.center)
    }

    private var presetRow: some View {
        HStack(spacing: 8) {
            Button { withAnimation(.spring) { session.apply(nil) } } label: { Pill(text: "Original", selected: session.activePreset == "Original") }
            ForEach(session.presets, id: \.presetId) { preset in
                Button { withAnimation(.spring) { session.apply(preset) } } label: { Pill(text: preset.label, selected: session.activePreset == preset.label) }
            }
        }
        .padding(.top, 12)
    }

    private var dock: some View {
        let n = session.nutrition
        return HStack(spacing: 12) {
            MacroRing(nutrition: n, size: 58)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(n.value("energy_reported").map { CF.number($0, digits: 0) } ?? "—") kcal · \(n.value("protein").map { CF.number($0) } ?? "—") g protein")
                    .font(.system(size: 15, weight: .heavy)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.75)
                    .contentTransition(.numericText()).animation(.snappy, value: n.value("energy_reported"))
                Text("\(session.priceCents.map(CF.euro) ?? "Pending") · DEMO ONLY")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(CF.yellow).lineLimit(1)
                    .contentTransition(.numericText()).animation(.snappy, value: session.priceCents)
                Text("Base ingredients · excl. sauce").font(.system(size: 11)).foregroundStyle(Color.white.opacity(0.75)).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            Button("Passport") { if session.sauce == nil { showSauce = true } else { showPassport = true } }
                .accessibilityHint(session.sauce == nil ? "Choose your required sauce first" : "Open your Nutrition Passport")
                .font(.system(size: 15, weight: .heavy)).foregroundStyle(CF.ink)
                .padding(.horizontal, 14).frame(minHeight: 46)
                .background(Capsule().fill(CF.yellow))
        }
        .padding(.leading, 12).padding(.trailing, 10).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(CF.ink).shadow(color: CF.ink.opacity(0.25), radius: 16, y: 8))
        .padding(.horizontal, 14).padding(.bottom, 8)
    }
}

struct Identified: Identifiable { let id: String }

/// The exploded bowl: plate photo in the middle, ingredient chips around it, sized by grams per bowl.
struct BowlStage: View {
    let session: BowlSession
    let onTapFood: (String) -> Void
    let onTapSauce: () -> Void
    @State private var bubbleTick = 0

    struct Chip: Identifiable { let id: String; let name: String; let grams: Double; let photo: String?; let isSauce: Bool }

    private var chips: [Chip] {
        var list = session.current.items.map { item in
            Chip(id: item.variantId, name: CF.shortName(session.food(item.variantId)?.nameEn ?? item.variantId), grams: item.grams,
                 photo: session.catalog.photo(for: item.variantId), isSauce: false)
        }
        if let sauce = session.sauce, let choice = session.current.sauce {
            list.append(Chip(id: "sauce", name: sauce.name, grams: choice.grams, photo: sauce.small ?? sauce.image, isSauce: true))
        } else {
            list.append(Chip(id: "sauce", name: "Choose sauce", grams: 0, photo: nil, isSauce: true))
        }
        return list
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let maxGrams = max(chips.map(\.grams).max() ?? 1, 1)
            ZStack {
                Circle().strokeBorder(CF.borderStrong, style: StrokeStyle(lineWidth: 2, dash: [6, 6]))
                    .frame(width: w * 0.84, height: w * 0.84)
                RemoteImage(path: session.product.small ?? session.product.image)
                    .frame(width: w * 0.46, height: w * 0.46).clipShape(Circle())
                    .background(Circle().fill(CF.yellow).offset(x: 8, y: 10))
                    .overlay(Circle().stroke(CF.yellowSoft, lineWidth: 9))
                    .accessibilityLabel(session.product.name)
                ForEach(Array(chips.enumerated()), id: \.element.id) { index, chip in
                    let angle = (-90 + Double(index) * 360 / Double(chips.count)) * .pi / 180
                    let size = chip.isSauce && chip.photo == nil ? w * 0.15 : (chip.grams > 0 ? w * (0.10 + 0.08 * sqrt(chip.grams / maxGrams)) : w * 0.09)
                    ChipView(chip: chip, size: size, labelWidth: w * 0.34,
                             bubbleDelta: session.changeDeltas[chip.id], bubbleTick: session.changeTick,
                             difference: chip.isSauce ? nil : session.differenceFromOriginal(chip.id))
                        .position(x: w / 2 + cos(angle) * w * 0.37, y: w / 2 + sin(angle) * w * 0.37)
                        .onTapGesture { chip.isSauce ? onTapSauce() : onTapFood(chip.id) }
                        .accessibilityElement(children: .combine)
                        .accessibilityAddTraits(.isButton)
                        .accessibilityLabel(chip.isSauce && chip.grams == 0 ? "Choose your sauce, required" : "\(chip.name), \(CF.number(chip.grams)) grams. Adjust")
                }
            }
            .frame(width: w, height: w)
            .animation(.spring(response: 0.45, dampingFraction: 0.62), value: session.current)
        }
        .aspectRatio(1, contentMode: .fit)
        .padding(.horizontal, 20)
    }
}

struct ChipView: View {
    let chip: BowlStage.Chip
    let size: CGFloat
    let labelWidth: CGFloat
    let bubbleDelta: Double?
    let bubbleTick: Int
    let difference: (delta: Double, isNew: Bool)?
    @State private var showBubble = false
    @State private var shownDelta: Double = 0
    @State private var bubbleGeneration = 0

    var body: some View {
        VStack(spacing: -8) {
            ZStack {
                if let photo = chip.photo {
                    RemoteImage(path: photo).frame(width: size, height: size).clipShape(Circle())
                } else {
                    Circle().fill(Color.white).frame(width: size, height: size)
                        .overlay(Circle().strokeBorder(CF.purple, style: StrokeStyle(lineWidth: 2, dash: [4, 4])))
                        .overlay(Image(systemName: "plus").font(.system(size: 18, weight: .bold)).foregroundStyle(CF.purple))
                }
            }
            .overlay(Circle().stroke(Color.white, lineWidth: 3))
            .overlay(Circle().stroke(chip.isSauce && chip.photo != nil ? CF.yellow : CF.ink, lineWidth: chip.isSauce ? 4 : 2).padding(-2))
            .background(Circle().fill(CF.ink).offset(x: 4, y: 5))
            .opacity(chip.grams > 0 || chip.isSauce ? 1 : 0.45)
            .overlay(alignment: .topTrailing) {
                // Persistent tag: how this food differs from the Original recipe.
                if let d = difference {
                    Text(d.isNew ? "New" : "\(d.delta > 0 ? "+" : "−")\(CF.number(abs(d.delta)))")
                        .font(.system(size: 10, weight: .heavy)).foregroundStyle(.white).monospacedDigit()
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Capsule().fill(d.isNew ? CF.purple : (d.delta > 0 ? CF.blue : CF.red)))
                        .overlay(Capsule().stroke(Color.white, lineWidth: 1.5))
                        .offset(x: 8, y: -4)
                        .transition(.scale.combined(with: .opacity))
                        .accessibilityLabel(d.isNew ? "Added food" : "\(d.delta > 0 ? "plus" : "minus") \(CF.number(abs(d.delta))) grams from the original")
                }
            }
            HStack(spacing: 3) {
                Text(chip.name).foregroundStyle(CF.ink)
                if chip.grams > 0 { Text("\(CF.number(chip.grams)) g").foregroundStyle(CF.blue) }
            }
            .font(.system(size: 11, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .background(Capsule().fill(Color.white)).overlay(Capsule().stroke(CF.ink, lineWidth: 1.5))
            .frame(maxWidth: labelWidth)
            .fixedSize(horizontal: false, vertical: true)
        }
        .overlay(alignment: .top) {
            if showBubble {
                let b = (delta: shownDelta, tick: bubbleTick)
                Text("\(b.delta > 0 ? "+" : "−")\(CF.number(abs(b.delta))) g")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(Capsule().fill(b.delta > 0 ? CF.blue : CF.red))
                    .offset(y: -18)
                    .transition(.asymmetric(insertion: .scale.combined(with: .opacity), removal: .move(edge: .top).combined(with: .opacity)))
            }
        }
        .onChange(of: bubbleTick) { _, _ in
            guard let delta = bubbleDelta else { return }
            shownDelta = delta
            bubbleGeneration += 1
            let generation = bubbleGeneration
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { showBubble = true }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(1.3))
                if generation == bubbleGeneration { withAnimation(.easeOut(duration: 0.4)) { showBubble = false } }
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: difference?.delta)
        .sensoryFeedback(.impact(weight: .light), trigger: bubbleDelta == nil ? 0 : bubbleTick)
    }
}

/// Energy ring: protein / carbohydrate / fat as shares of their combined grams (not a health score).
struct MacroRing: View {
    let nutrition: NutritionResult
    var size: CGFloat = 60
    var onDark = true

    var body: some View {
        let parts: [(Double?, Color)] = [(nutrition.value("protein"), CF.blue), (nutrition.value("carbohydrate_by_difference"), CF.yellow), (nutrition.value("fat"), CF.purple)]
        let total = parts.compactMap(\.0).reduce(0, +)
        let complete = parts.allSatisfy { $0.0 != nil } && total > 0
        ZStack {
            Circle().stroke(onDark ? Color.white.opacity(0.15) : CF.track, lineWidth: size * 0.16)
            if complete {
                let starts = parts.indices.map { i in parts[..<i].compactMap(\.0).reduce(0, +) / total }
                ForEach(parts.indices, id: \.self) { i in
                    Circle().trim(from: starts[i], to: starts[i] + (parts[i].0 ?? 0) / total - 0.01)
                        .stroke(parts[i].1, style: StrokeStyle(lineWidth: size * 0.16, lineCap: .butt))
                        .rotationEffect(.degrees(-90))
                }
            }
            Text(nutrition.value("energy_reported").map { CF.number($0, digits: 0) } ?? "—")
                .font(.system(size: size * 0.24, weight: .heavy)).foregroundStyle(onDark ? .white : CF.ink)
                .contentTransition(.numericText())
        }
        .frame(width: size, height: size)
        .animation(.spring(response: 0.5, dampingFraction: 0.7), value: total)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Energy \(nutrition.value("energy_reported").map { CF.number($0, digits: 0) } ?? "not fully quantified") kilocalories")
    }
}
