// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "WebViewApp",
    platforms: [.iOS(.v14)],
    products: [
        .library(name: "WebViewApp", targets: ["WebViewApp"])
    ],
    dependencies: [
        .package(url: "https://github.com/nicklockwood/SwiftFormat", from: "0.52.0")
    ],
    targets: [
        .target(name: "WebViewApp", dependencies: [])
    ]
)
