// swift-tools-version: 5.9
import PackageDescription

// Catalogue models, nutrition engine, standard portions and demo pricing shared by the iOS app.
// Pure Swift so `swift test` runs on a Mac against fixtures generated from the website's own engine.
let package = Package(
    name: "ColourFuelKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "ColourFuelKit", targets: ["ColourFuelKit"])],
    targets: [
        .target(name: "ColourFuelKit"),
        .testTarget(name: "ColourFuelKitTests", dependencies: ["ColourFuelKit"], resources: [.copy("Fixtures")])
    ]
)
