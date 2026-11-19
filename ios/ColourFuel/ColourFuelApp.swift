import SwiftUI
import ColourFuelKit

@main
struct ColourFuelApp: App {
    @State private var store = CatalogStore()

    var body: some Scene {
        WindowGroup {
            RootView(store: store)
                .tint(CF.blue)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    let store: CatalogStore

    var body: some View {
        Group {
            switch store.phase {
            case .loading:
                VStack(spacing: 16) {
                    RemoteImage(path: "colourfuel-horizontal.jpg").frame(width: 200, height: 66).clipped()
                    ProgressView()
                    Text("Checking the ingredients for your bowl…").font(.subheadline).foregroundStyle(CF.muted)
                }
            case .failed(let message):
                VStack(spacing: 16) {
                    Text("A little pause.").font(CF.display(28)).foregroundStyle(CF.ink)
                    Text(message).multilineTextAlignment(.center).foregroundStyle(CF.muted).padding(.horizontal, 32)
                    Button("Try again") { Task { await store.load() } }.buttonStyle(PopButtonStyle()).frame(width: 200)
                }
            case .ready(let catalog):
                if let first = catalog.bowls.first {
                    BowlStageScreen(session: BowlSession(catalog: catalog, product: first))
                } else {
                    Text("No bowls are available right now.").foregroundStyle(CF.muted)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
        .task { if case .loading = store.phase { await store.load() } }
    }
}
