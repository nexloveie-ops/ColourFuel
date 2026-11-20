import SwiftUI
import PhotosUI
import UIKit
import ColourFuelKit

/// Ingredient library search by photo: recognise the foods in a picture and open them in the library.
/// Uses the same endpoint, consent and privacy rules as the meal photo estimate; foods that are not in the
/// library are added from a pack label or USDA record by the server and appear here straight away.
struct FoodIdentifySheet: View {
    let session: BowlSession
    let onOpen: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage("photoEstimateConsent") private var consented = false

    enum Phase { case choose, analysing(UIImage), result(UIImage, PhotoEstimate), failed(String) }
    @State private var phase: Phase = .choose
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) { content }.padding(20)
            }
            .navigationTitle("Find by photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { dismiss() } } }
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) { identify(image) }
                else { phase = .failed("This photo could not be opened.") }
                pickerItem = nil
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in showCamera = false; if let image { identify(image) } }.ignoresSafeArea()
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .choose:
            Text("Photograph a food to find it in the library. If it isn’t there yet, ColourFuel adds it from the pack label or a USDA record.")
                .font(.subheadline).foregroundStyle(CF.muted)
            if consented { pickers } else { consent }
        case .analysing(let image):
            preview(image)
            HStack(spacing: 10) { ProgressView(); Text("Looking for foods…").font(.headline).foregroundStyle(CF.ink) }
        case .result(let image, let estimate):
            preview(image)
            results(estimate)
            Button { withAnimation(.snappy) { phase = .choose } } label: { Label("Try another photo", systemImage: "arrow.counterclockwise") }
                .buttonStyle(PopButtonStyle(fill: CF.yellow, text: CF.ink))
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle.fill").font(.headline).foregroundStyle(CF.red)
            Button("Try again") { phase = .choose }.buttonStyle(PopButtonStyle())
        }
    }

    private var consent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Before you send a photo", systemImage: "hand.raised.fill").font(.headline).foregroundStyle(CF.purple)
            Text("Your photo is sent to ColourFuel’s server and analysed by Claude, an AI model from Anthropic, to identify foods. ColourFuel doesn’t store your photo.")
                .font(.subheadline).foregroundStyle(CF.ink).fixedSize(horizontal: false, vertical: true)
            Button("Agree and continue") { withAnimation(.snappy) { consented = true } }.buttonStyle(PopButtonStyle())
        }
        .padding(16).background(RoundedRectangle(cornerRadius: 20).fill(CF.purpleSoft))
    }

    private var pickers: some View {
        VStack(spacing: 12) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { showCamera = true } label: { Label("Take a photo", systemImage: "camera.fill") }.buttonStyle(PopButtonStyle())
            }
            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("Choose from Photos", systemImage: "photo.on.rectangle").font(.system(size: 17, weight: .heavy)).foregroundStyle(CF.blue)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().strokeBorder(CF.blue, lineWidth: 2))
            }
        }
    }

    private func preview(_ image: UIImage) -> some View {
        Color.clear.frame(maxWidth: .infinity).frame(height: 180)
            .overlay(Image(uiImage: image).resizable().scaledToFill())
            .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    @ViewBuilder private func results(_ estimate: PhotoEstimate) -> some View {
        let lib = session.catalog
        if estimate.matched.isEmpty && estimate.unmatched.isEmpty {
            Label("No food found in this photo. Try a closer shot.", systemImage: "eye.slash").font(.headline).foregroundStyle(CF.ink)
        }
        if !estimate.matched.isEmpty {
            Text("FOUND IN THE LIBRARY").font(.system(size: 12, weight: .heavy)).kerning(1.2).foregroundStyle(CF.blue)
            ForEach(estimate.matched) { food in
                if let id = food.variantId, let record = lib.ingredient(id) {
                    Button { open(id) } label: {
                        HStack(spacing: 12) {
                            RemoteImage(path: lib.photo(for: id) ?? "colourfuel-round.jpg").frame(width: 52, height: 52).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 3) {
                                Text(record.nameEn).font(.headline).foregroundStyle(CF.ink)
                                Text(food.addedNow ? "Added to the library now · \(record.photoAddition?.sourceLabel ?? "sourced")"
                                     : record.photoAddition != nil ? "Library · added from a photo" : "Library")
                                    .font(.caption.weight(.semibold)).foregroundStyle(food.addedNow ? CF.purple : CF.blue)
                                Text(Library.quickLook(record, catalog: lib)).font(.caption).foregroundStyle(CF.muted).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(CF.muted)
                        }
                        .padding(12).background(RoundedRectangle(cornerRadius: 16).stroke(CF.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !estimate.unmatched.isEmpty {
            Text("SEEN, NO SOURCE FOUND").font(.system(size: 12, weight: .heavy)).kerning(1.2).foregroundStyle(CF.purple)
            ForEach(estimate.unmatched) { food in
                Text("\(food.label) · not in the library, and no pack label or USDA record matched").font(.subheadline).foregroundStyle(CF.muted)
            }
        }
    }

    private func open(_ id: String) { dismiss(); onOpen(id) }

    private func identify(_ image: UIImage) {
        withAnimation(.snappy) { phase = .analysing(image) }
        Task {
            do {
                let estimate = try await PhotoEstimateAPI.estimate(image)
                session.mergeLibrary((estimate.foodRecords ?? []).filter { session.catalog.ingredient($0.variantId) == nil }, photos: estimate.foodPhotos ?? [])
                // One food and nothing else: go straight to it.
                if estimate.matched.count == 1, estimate.unmatched.isEmpty, let id = estimate.matched[0].variantId, session.catalog.ingredient(id) != nil {
                    open(id); return
                }
                withAnimation(.snappy) { phase = .result(image, estimate) }
            } catch let failure as PhotoEstimateAPI.Failure {
                withAnimation(.snappy) { phase = .failed(failure.message) }
            } catch {
                withAnimation(.snappy) { phase = .failed("Photo search is not available right now.") }
            }
        }
    }
}

/// Camera button beside the library search field (bottom search bar on iOS 26, top bar before).
struct PhotoSearchButton: ViewModifier {
    let action: () -> Void
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.toolbar {
                DefaultToolbarItem(kind: .search, placement: .bottomBar)
                ToolbarSpacer(.fixed, placement: .bottomBar)
                ToolbarItem(placement: .bottomBar) { button }
            }
        } else {
            content.toolbar { ToolbarItem(placement: .topBarLeading) { button } }
        }
    }
    private var button: some View {
        Button(action: action) { Image(systemName: "camera.viewfinder") }
            .accessibilityLabel("Find a food by photo")
    }
}
