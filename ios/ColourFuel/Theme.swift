import SwiftUI

/// Colour Pop tokens, matching brand-tokens.css on the website.
enum CF {
    static let ink = Color(hex: 0x24243F)
    static let muted = Color(hex: 0x5B6276)
    static let blue = Color(hex: 0x294BD1)
    static let yellow = Color(hex: 0xFFDA42)
    static let yellowInk = Color(hex: 0x65500E)
    static let purple = Color(hex: 0x783EC2)
    static let red = Color(hex: 0xD32D43)
    static let blueSoft = Color(hex: 0xF0F4FF)
    static let purpleSoft = Color(hex: 0xF5F0FC)
    static let yellowSoft = Color(hex: 0xFFF8DC)
    static let border = Color(hex: 0xDFE2EC)
    static let borderStrong = Color(hex: 0xB4BDD2)
    static let track = Color(hex: 0xE4E8F6)

    /// Images and the catalogue come from the live website (same origin as the API).
    static let site = URL(string: "https://www.colourfuel.ie/")!
    static func url(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(string: path, relativeTo: site)?.absoluteURL
    }

    /// The ColourFuel logos ship inside the app, so they show at once and offline instead of waiting on the network.
    static func bundled(_ path: String?) -> UIImage? {
        guard let path, ["colourfuel-horizontal.jpg", "colourfuel-round.jpg"].contains(path) else { return nil }
        return UIImage(named: String(path.dropLast(4)))
    }

    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .heavy) }

    static func euro(_ cents: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .currency; f.currencyCode = "EUR"; f.locale = Locale(identifier: "en_IE")
        return f.string(from: NSNumber(value: Double(cents) / 100)) ?? "€\(cents / 100)"
    }

    static func number(_ value: Double, digits: Int = 1) -> String {
        let f = NumberFormatter(); f.maximumFractionDigits = digits; f.minimumFractionDigits = 0; f.locale = Locale(identifier: "en_IE")
        return f.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func stateLabel(_ state: String) -> String {
        [
            "raw": "Raw", "boiled": "Boiled · cooked", "cooked": "Cooked", "roasted": "Roasted · cooked", "ready_to_use": "Ready to use",
            "ready_to_eat": "Ready to eat", "toasted": "Toasted", "dry": "Dry", "dried": "Dried", "unroasted": "Unroasted", "pasteurised": "Pasteurised",
            "grilled": "Grilled · cooked", "fried": "Fried · cooked", "baked": "Baked · cooked", "smoked": "Smoked", "cured": "Cured", "steamed": "Steamed · cooked"
        ][state] ?? state
    }

    static func shortName(_ name: String) -> String {
        name.split(whereSeparator: { ",(—".contains($0) }).first.map { $0.trimmingCharacters(in: .whitespaces) } ?? name
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// Photo from the website, cropped to fill its frame.
struct RemoteImage: View {
    let path: String?
    var body: some View {
        if let local = CF.bundled(path) {
            Image(uiImage: local).resizable().scaledToFill()
        } else {
            remote
        }
    }

    private var remote: some View {
        AsyncImage(url: CF.url(path), transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFill()
            case .failure: CF.purpleSoft
            default: CF.blueSoft
            }
        }
    }
}

/// Pill used for presets, labels and chips.
struct Pill: View {
    let text: String
    var selected = false
    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: selected ? .heavy : .semibold))
            .foregroundStyle(CF.ink)
            .padding(.horizontal, 14).frame(minHeight: 40)
            .background(Capsule().fill(selected ? CF.yellow : Color.white))
            .overlay(Capsule().stroke(selected ? CF.ink : CF.borderStrong, lineWidth: 1.5))
    }
}

/// Primary button with the ink offset shadow.
struct PopButtonStyle: ButtonStyle {
    var fill: Color = CF.blue
    var text: Color = .white
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .heavy))
            .foregroundStyle(text)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Capsule().fill(fill))
            .background(Capsule().fill(CF.ink).offset(x: 3, y: 4))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
