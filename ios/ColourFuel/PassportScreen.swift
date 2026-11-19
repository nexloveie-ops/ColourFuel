import SwiftUI
import Photos
import ColourFuelKit

/// Passport: the 1080×1350 social card (Instagram/Facebook 4:5), Save to Photos, share the image or a bowl link.
struct PassportScreen: View {
    let session: BowlSession
    @Environment(\.dismiss) private var dismiss
    @State private var rendered: UIImage?
    @State private var status: String?
    @State private var showNutrition = false

    private var model: PassportCardModel {
        PassportCardModel(productName: session.product.name, original: session.original, current: session.current, catalog: session.catalog)
    }
    private var shareURL: URL? {
        guard let recipe = session.catalog.recipe(for: session.product),
              let code = BowlShare.code(product: session.product, recipe: recipe, original: session.original, current: session.current) else { return nil }
        return BowlShare.url(site: CF.site, productId: session.product.productId, code: code)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.down").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(Circle().fill(Color.white.opacity(0.14)))
                }
                .accessibilityLabel("Close Passport")
                Spacer()
                Text("YOUR PASSPORT").font(.system(size: 13, weight: .heavy)).kerning(1.2).foregroundStyle(CF.yellow)
                Spacer()
                Button { showNutrition = true } label: {
                    Image(systemName: "list.bullet.rectangle").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(Circle().fill(Color.white.opacity(0.14)))
                }
                .accessibilityLabel("Full nutrition")
            }
            .padding(.horizontal, 16).padding(.top, 8)

            Spacer(minLength: 8)
            Group {
                if let rendered {
                    Image(uiImage: rendered).resizable().aspectRatio(1080.0 / 1350.0, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .accessibilityLabel("Passport card for \(model.name)")
                } else {
                    RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.1)).aspectRatio(1080.0 / 1350.0, contentMode: .fit)
                        .overlay(ProgressView().tint(.white))
                }
            }
            .padding(.horizontal, 44)
            .rotationEffect(.degrees(-2))
            .background(RoundedRectangle(cornerRadius: 18).fill(CF.yellow).padding(.horizontal, 44).offset(x: 8, y: 10).rotationEffect(.degrees(-2)))
            .transition(.scale(scale: 0.9).combined(with: .opacity))
            Text("1080 × 1350 · ready for Instagram and Facebook").font(.footnote).foregroundStyle(CF.border).padding(.top, 18)
            Spacer(minLength: 8)

            VStack(spacing: 10) {
                if let status { Text(status).font(.footnote.weight(.semibold)).foregroundStyle(CF.yellow).transition(.opacity) }
                Button("Save to Photos") { Task { await save() } }
                    .buttonStyle(PopButtonStyle(fill: CF.yellow, text: CF.ink)).disabled(rendered == nil)
                HStack(spacing: 10) {
                    if let rendered {
                        ShareLink(item: Image(uiImage: rendered), preview: SharePreview("\(model.name) · ColourFuel Passport", image: Image(uiImage: rendered))) {
                            outlineLabel("Share image")
                        }
                    }
                    if let url = shareURL {
                        ShareLink(item: url, subject: Text("My ColourFuel bowl"), message: Text("Open it to see the same portions, ingredients and sauce.")) {
                            outlineLabel("Share bowl link")
                        }
                    }
                }
                Text("Concept preview · base ingredients, excludes sauce · not medical advice. Ordering isn’t available yet.")
                    .font(.caption2).foregroundStyle(Color.white.opacity(0.7)).multilineTextAlignment(.center)
            }
            .padding(.horizontal, 20).padding(.bottom, 12)
        }
        .background(CF.ink.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .task { await render() }
        .sheet(isPresented: $showNutrition) { NutritionSheet(session: session).presentationDetents([.large]) }
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: rendered != nil)
        .animation(.easeOut, value: status)
    }

    private func outlineLabel(_ text: String) -> some View {
        Text(text).font(.system(size: 15, weight: .heavy)).foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .overlay(Capsule().stroke(Color.white, lineWidth: 2))
    }

    /// Photos are loaded first so the renderer draws real images (AsyncImage cannot be captured).
    private func render() async {
        async let photo = loadImage(session.product.image ?? session.product.small)
        async let logo = loadImage("colourfuel-horizontal.jpg")
        let (p, l) = await (photo, logo)
        let renderer = ImageRenderer(content: PassportCard(model: model, photo: p, logo: l).frame(width: 1080, height: 1350))
        renderer.scale = 1
        rendered = renderer.uiImage
    }

    private func loadImage(_ path: String?) async -> UIImage? {
        guard let url = CF.url(path), let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
        return UIImage(data: data)
    }

    private func save() async {
        guard let image = rendered else { return }
        let access = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard access == .authorized || access == .limited else {
            status = "Photos access is off. Allow “Add Photos Only” in Settings to save the card."
            return
        }
        do {
            try await PHPhotoLibrary.shared().performChanges { PHAssetChangeRequest.creationRequestForAsset(from: image) }
            status = "Saved to Photos"
        } catch {
            status = "The card couldn’t be saved. Please try again."
        }
    }
}

/// The social card, drawn at 1080×1350 design units.
struct PassportCard: View {
    let model: PassportCardModel
    let photo: UIImage?
    let logo: UIImage?
    private let colours = [CF.blue, CF.yellow, CF.purple, CF.red]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 0) { ForEach([CF.blue, CF.yellow, CF.red, CF.purple], id: \.self) { $0.frame(height: 14) } }
            HStack {
                logoView(height: 66)
                Spacer()
                Text("NUTRITION PASSPORT").font(.system(size: 24, weight: .heavy)).foregroundStyle(CF.purple)
                    .padding(.horizontal, 20).frame(height: 50).background(Capsule().fill(CF.purpleSoft))
            }
            .padding(.horizontal, 60).padding(.top, 30)
            ZStack(alignment: .topLeading) {
                Group {
                    if let photo { Image(uiImage: photo).resizable().scaledToFill() } else { CF.purpleSoft }
                }
                .frame(width: 960, height: 520).clipShape(RoundedRectangle(cornerRadius: 40, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 40, style: .continuous).stroke(CF.ink, lineWidth: 3))
                Text(model.isCustom ? "My custom mix" : "Original Recipe").font(.system(size: 26, weight: .bold)).foregroundStyle(CF.ink)
                    .padding(.horizontal, 20).frame(height: 50)
                    .background(Capsule().fill(model.isCustom ? CF.yellow : .white)).overlay(Capsule().stroke(CF.ink, lineWidth: 2.5))
                    .padding(24)
                stamp.offset(x: 960 - 224 - 20, y: 520 - 30 - 112)
            }
            .padding(.horizontal, 60).padding(.top, 26)
            Text(model.name).font(.system(size: 76, weight: .heavy)).foregroundStyle(CF.ink).lineLimit(1).minimumScaleFactor(0.6)
                .padding(.horizontal, 60).padding(.top, 34)
            Text("\(Int(model.bowlGrams)) g per bowl\(model.sauceName.map { " · with \($0)" } ?? "")").font(.system(size: 32, weight: .medium)).foregroundStyle(CF.muted)
                .padding(.horizontal, 60).padding(.top, 8)
            HStack(spacing: 40) {
                ring
                Grid(horizontalSpacing: 24, verticalSpacing: 24) {
                  ForEach(0..<2) { row in
                   GridRow {
                    ForEach(Array(model.macros.enumerated()).filter { $0.offset / 2 == row }, id: \.offset) { i, m in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(m.label.uppercased()).font(.system(size: 22, weight: .heavy)).foregroundStyle(CF.muted)
                            Text(m.grams.map { "\(CF.number($0)) g" } ?? "—").font(.system(size: 46, weight: .black)).foregroundStyle(CF.ink).lineLimit(1).fixedSize()
                        }
                        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading).padding(.leading, 24)
                        .background(RoundedRectangle(cornerRadius: 26).fill(.white))
                        .overlay(RoundedRectangle(cornerRadius: 26).stroke(CF.ink, lineWidth: 3))
                        .background(RoundedRectangle(cornerRadius: 26).fill([CF.blue, CF.yellow, CF.purple, CF.red][i]).offset(x: 6, y: 8))
                    }
                   }
                  }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 60).padding(.top, model.changes.isEmpty ? 56 : 32)
            if !model.changes.isEmpty {
                HStack(spacing: 12) {
                    Text("MY CHANGES").font(.system(size: 22, weight: .heavy)).foregroundStyle(CF.purple)
                    ForEach(model.changes, id: \.self) { c in
                        Text(c).font(.system(size: 24, weight: .bold)).foregroundStyle(c.hasPrefix("+") ? CF.blue : CF.purple)
                            .padding(.horizontal, 18).frame(height: 44).background(Capsule().fill(c.hasPrefix("+") ? CF.blueSoft : CF.purpleSoft))
                    }
                }
                .lineLimit(1).padding(.horizontal, 60).padding(.top, 30)
            }
            Spacer(minLength: 0)
            Rectangle().fill(Color(hex: 0xE5E2F0)).frame(height: 2).padding(.horizontal, 60)
            HStack {
                Text("colourfuel.ie").font(.system(size: 30, weight: .black)).foregroundStyle(CF.ink)
                Spacer()
                Text("Concept preview · base ingredients, excludes sauce · not medical advice").font(.system(size: 20, weight: .medium)).foregroundStyle(CF.muted)
            }
            .padding(.horizontal, 60).padding(.top, 24).padding(.bottom, 36)
        }
        .frame(width: 1080, height: 1350)
        .background(Color.white)
    }

    @ViewBuilder private func logoView(height: CGFloat) -> some View {
        if let logo {
            // The horizontal logo cropped to letters, leaves and swoosh (tagline excluded), as on the website stamp.
            let crop = CGRect(x: 225, y: 40, width: 1705, height: 540)
            if let cg = logo.cgImage?.cropping(to: crop) {
                Image(uiImage: UIImage(cgImage: cg)).resizable().aspectRatio(crop.width / crop.height, contentMode: .fit).frame(height: height)
            }
        } else {
            Text("ColourFuel").font(.system(size: height * 0.6, weight: .black)).foregroundStyle(CF.ink)
        }
    }

    private var stamp: some View {
        ZStack {
            Circle().fill(.white).shadow(color: CF.ink.opacity(0.22), radius: 0, x: 6, y: 8)
            ForEach(0..<4) { i in
                Circle().trim(from: Double(i) / 4, to: Double(i + 1) / 4).stroke(colours[i], lineWidth: 14)
                    .rotationEffect(.degrees(-135)).padding(7)
            }
            Circle().stroke(Color(hex: 0xCDB8EC), style: StrokeStyle(lineWidth: 2.5, dash: [7, 6])).padding(26)
            VStack(spacing: 4) {
                logoView(height: 40)
                Text("F O O D").font(.system(size: 21, weight: .heavy)).foregroundStyle(CF.purple)
                Text("P A S S P O R T").font(.system(size: 21, weight: .heavy)).foregroundStyle(CF.purple)
            }
        }
        .frame(width: 224, height: 224)
        .rotationEffect(.degrees(-14))
    }

    private var ring: some View {
        let parts = model.macros.prefix(3).map(\.grams)
        let total = parts.compactMap { $0 }.reduce(0, +)
        let complete = parts.allSatisfy { $0 != nil } && total > 0
        return ZStack {
            Circle().stroke(Color(hex: 0xECEFFA), lineWidth: 30)
            if complete {
                let starts = parts.indices.map { i in parts[..<i].compactMap { $0 }.reduce(0, +) / total }
                ForEach(Array(parts.indices), id: \.self) { i in
                    Circle().trim(from: starts[i] + 0.005, to: starts[i] + (parts[i] ?? 0) / total - 0.005)
                        .stroke([CF.blue, CF.yellow, CF.purple][i], lineWidth: 30).rotationEffect(.degrees(-90))
                }
            }
            VStack(spacing: 0) {
                Text(model.kcal.map { String(Int($0)) } ?? "—").font(.system(size: 70, weight: .black)).foregroundStyle(CF.ink)
                Text("KCAL").font(.system(size: 24, weight: .heavy)).foregroundStyle(CF.muted)
            }
        }
        .frame(width: 236, height: 236)
    }
}
