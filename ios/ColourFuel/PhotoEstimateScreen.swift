import SwiftUI
import PhotosUI
import UIKit
import ColourFuelKit

/// Talks to `/api/photo-estimate`. The photo goes to our server only, which asks Claude to name
/// foods and estimate grams; nothing is stored. Debug builds can point at a local server with
/// `defaults write ie.colourfuel.app CFAPIBase http://127.0.0.1:4180/`.
enum PhotoEstimateAPI {
    static var base: URL {
        #if DEBUG
        if let s = UserDefaults.standard.string(forKey: "CFAPIBase"), let u = URL(string: s) { return u }
        #endif
        return CF.site
    }
    static var endpoint: URL { base.appendingPathComponent("api/photo-estimate") }

    struct Failure: Error { let message: String }

    /// `GET` tells the app whether the server has photo estimates switched on.
    static func isAvailable() async -> Bool {
        guard let (data, response) = try? await URLSession.shared.data(from: endpoint),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
        return json["available"] as? Bool ?? false
    }

    static func estimate(_ image: UIImage) async throws -> PhotoEstimate {
        guard let jpeg = image.preparedForUpload() else { throw Failure(message: "This photo could not be read.") }
        var request = URLRequest(url: endpoint, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["media_type": "image/jpeg", "image_base64": jpeg.base64EncodedString()])
        let data: Data, response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: request) }
        catch { throw Failure(message: "We couldn’t reach ColourFuel. Check your connection and try again.") }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw Failure(message: message ?? "Photo estimate is not available right now.")
        }
        do { return try PhotoEstimate.decode(data) }
        catch { throw Failure(message: "The estimate could not be read. Please try again.") }
    }
}

extension UIImage {
    /// Longest side 1280 px, JPEG — enough to recognise foods, small to send.
    func preparedForUpload(maxSide: CGFloat = 1280) -> Data? {
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.72)
    }
}

struct PhotoEstimateScreen: View {
    let catalog: Catalog
    @Environment(\.dismiss) private var dismiss
    @AppStorage("photoEstimateConsent") private var consented = false

    enum Phase { case choose, analysing(UIImage), result(UIImage, PhotoEstimate), failed(UIImage?, String) }
    @State private var phase: Phase = .choose
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var grams: [String: Double] = [:]
    @State private var available: Bool?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) { content }
                    .padding(20)
            }
            .background(Color.white)
            .navigationTitle("Photo estimate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.fontWeight(.bold) } }
        }
        .task { available = await PhotoEstimateAPI.isAvailable() }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) { analyse(image) }
                else { phase = .failed(nil, "This photo could not be opened.") }
                pickerItem = nil
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in showCamera = false; if let image { analyse(image) } }.ignoresSafeArea()
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .choose:
            intro
            if available == false {
                Label("Photo estimates aren’t switched on yet. Please check back soon.", systemImage: "clock").font(.headline).foregroundStyle(CF.purple)
            } else if available == nil {
                ProgressView().frame(maxWidth: .infinity)
            } else if consented { pickers } else { consentCard }
        case .analysing(let image):
            photo(image)
            HStack(spacing: 12) { ProgressView(); Text("Looking for foods in your photo…").font(.headline).foregroundStyle(CF.ink) }
            Text("This usually takes a few seconds.").font(.subheadline).foregroundStyle(CF.muted)
        case .result(let image, let estimate):
            photo(image)
            results(estimate)
            againButton
        case .failed(let image, let message):
            if let image { photo(image) }
            Label(message, systemImage: "exclamationmark.triangle.fill").font(.headline).foregroundStyle(CF.red)
            againButton
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("What’s on the plate?").font(CF.display(28)).foregroundStyle(CF.ink)
            Text("Snap a meal and we’ll estimate the foods and weights, then calculate nutrition from our ingredient library. You can adjust every weight.")
                .font(.subheadline).foregroundStyle(CF.muted)
        }
    }

    private var consentCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Before you send a photo", systemImage: "hand.raised.fill").font(.headline).foregroundStyle(CF.purple)
            VStack(alignment: .leading, spacing: 6) {
                bullet("Your photo is sent to ColourFuel’s server and analysed by Claude, an AI model from Anthropic, to identify foods.")
                bullet("ColourFuel doesn’t store your photo. It is used for this one estimate.")
                bullet("Weights are guesses from a picture, not measurements. Sauces and foods outside our library aren’t counted.")
            }
            Button("Agree and continue") { withAnimation(.snappy) { consented = true } }.buttonStyle(PopButtonStyle())
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 20).fill(CF.purpleSoft))
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle().fill(CF.purple).frame(width: 6, height: 6)
            Text(text).font(.subheadline).foregroundStyle(CF.ink).fixedSize(horizontal: false, vertical: true)
        }
    }

    private var pickers: some View {
        VStack(spacing: 12) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { showCamera = true } label: { Label("Take a photo", systemImage: "camera.fill") }.buttonStyle(PopButtonStyle())
            }
            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("Choose from Photos", systemImage: "photo.on.rectangle").font(.system(size: 17, weight: .heavy)).foregroundStyle(CF.blue)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Capsule().strokeBorder(CF.blue, lineWidth: 2))
            }
            Text("Photos are analysed by Claude (Anthropic) and not stored by ColourFuel.").font(.caption).foregroundStyle(CF.muted)
        }
    }

    private func photo(_ image: UIImage) -> some View {
        Color.clear.frame(maxWidth: .infinity).frame(height: 220)
            .overlay(Image(uiImage: image).resizable().scaledToFill())
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .accessibilityLabel("Your meal photo")
    }

    @ViewBuilder private func results(_ estimate: PhotoEstimate) -> some View {
        if !estimate.isFoodPhoto || estimate.foods.isEmpty {
            Label("We couldn’t spot a meal in this photo. Try a clearer shot from above.", systemImage: "eye.slash").font(.headline).foregroundStyle(CF.ink)
        } else {
            let recipe = estimate.recipe(grams: grams, catalog: catalog)
            let n = NutritionEngine.calculate(recipe, catalog: catalog)
            totals(n, counted: recipe.items.count)
            if !estimate.note.isEmpty { Text(estimate.note).font(.subheadline).foregroundStyle(CF.muted) }
            if !estimate.matched.isEmpty {
                Text("ADJUST THE WEIGHTS").font(.system(size: 12, weight: .heavy)).kerning(1.2).foregroundStyle(CF.blue)
                ForEach(estimate.matched) { food in foodRow(food) }
            }
            if !estimate.unmatched.isEmpty {
                Text("SEEN, NOT COUNTED").font(.system(size: 12, weight: .heavy)).kerning(1.2).foregroundStyle(CF.purple)
                ForEach(estimate.unmatched) { food in
                    HStack {
                        Text(food.label).font(.subheadline.weight(.semibold)).foregroundStyle(CF.ink)
                        Spacer()
                        Text("Not in our library").font(.caption).foregroundStyle(CF.muted)
                    }
                }
            }
            if estimate.sauceOrDressingVisible {
                Label("Sauce or dressing spotted · not counted", systemImage: "drop.fill").font(.subheadline.weight(.semibold)).foregroundStyle(CF.yellowInk)
            }
            Text("Estimate from a photo. Weights are guesses, not measurements; nutrition uses this library’s records for the matched foods only. Not medical or dietary advice.")
                .font(.caption).foregroundStyle(CF.muted)
        }
    }

    private func totals(_ n: NutritionResult, counted: Int) -> some View {
        let tiles: [(String, String, Int)] = [("energy_reported", "kcal", 0), ("protein", "protein g", 1), ("carbohydrate_by_difference", "carbs g", 1), ("fat", "fat g", 1), ("fibre_total_dietary", "fibre g", 1)]
        return VStack(alignment: .leading, spacing: 10) {
            Text("ESTIMATE · \(counted) FOOD\(counted == 1 ? "" : "S") COUNTED").font(.system(size: 12, weight: .heavy)).kerning(1.2).foregroundStyle(CF.yellowInk)
            HStack(spacing: 8) {
                ForEach(tiles, id: \.0) { id, label, digits in
                    let metric = n.metrics[id]
                    VStack(spacing: 2) {
                        Text(n.value(id).map { CF.number($0, digits: digits) } ?? "—").font(.system(size: 18, weight: .black)).foregroundStyle(CF.ink)
                            .contentTransition(.numericText()).animation(.snappy, value: n.value(id))
                        Text(label + (metric?.status == .incomplete ? "*" : "")).font(.caption2).foregroundStyle(CF.muted)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.white))
                }
            }
            if tiles.contains(where: { n.metrics[$0.0]?.status == .incomplete }) {
                Text("* Some matched foods have no value for this nutrient.").font(.caption2).foregroundStyle(CF.muted)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 20).fill(CF.yellowSoft))
    }

    private func foodRow(_ food: PhotoEstimate.Food) -> some View {
        let id = food.variantId ?? ""
        let record = catalog.ingredient(id)
        let value = grams[id] ?? food.grams
        let upper = max(300, (food.grams * 2 / 10).rounded(.up) * 10)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                RemoteImage(path: catalog.photo(for: id)).frame(width: 44, height: 44).clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(record?.nameEn ?? food.label).font(.subheadline.weight(.heavy)).foregroundStyle(CF.ink)
                    Text("Seen as “\(food.label)” · \(food.confidence) confidence · estimated \(Int(food.grams)) g").font(.caption2).foregroundStyle(CF.muted).lineLimit(2)
                }
                Spacer()
                Text("\(Int(value)) g").font(.system(size: 17, weight: .black)).foregroundStyle(CF.blue).monospacedDigit()
            }
            Slider(value: Binding(get: { value }, set: { grams[id] = ($0 / 5).rounded() * 5 }), in: 0...upper)
                .tint(CF.blue)
                .accessibilityLabel("\(record?.nameEn ?? food.label) grams")
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16).stroke(CF.border, lineWidth: 1.5))
    }

    private var againButton: some View {
        Button { withAnimation(.snappy) { phase = .choose; grams = [:] } } label: { Label("Try another photo", systemImage: "arrow.counterclockwise") }
            .buttonStyle(PopButtonStyle(fill: CF.yellow, text: CF.ink))
    }

    private func analyse(_ image: UIImage) {
        grams = [:]
        withAnimation(.snappy) { phase = .analysing(image) }
        Task {
            do {
                let estimate = try await PhotoEstimateAPI.estimate(image)
                withAnimation(.snappy) { phase = .result(image, estimate) }
            } catch let failure as PhotoEstimateAPI.Failure {
                withAnimation(.snappy) { phase = .failed(image, failure.message) }
            } catch {
                withAnimation(.snappy) { phase = .failed(image, "Photo estimate is not available right now.") }
            }
        }
    }
}

/// Minimal camera wrapper (PhotosPicker has no camera).
struct CameraPicker: UIViewControllerRepresentable {
    let onFinish: (UIImage?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (UIImage?) -> Void
        init(onFinish: @escaping (UIImage?) -> Void) { self.onFinish = onFinish }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish(info[.originalImage] as? UIImage)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onFinish(nil) }
    }
}
