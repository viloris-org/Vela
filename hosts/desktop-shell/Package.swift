// swift-tools-version: 5.9
//
// Phase 1 macOS composition Shell MVP — AppKit + WKWebView.
// Build on macOS with Xcode / Swift 5.9+:
//   cd hosts/desktop-shell
//   swift build -c release --product vela-desktop-shell
//   .build/release/vela-desktop-shell --url http://127.0.0.1:5174
//
// See README.md and docs/macos-spike-architecture.md.

import PackageDescription

let package = Package(
  name: "VelaShell",
  platforms: [
    .macOS(.v14),
  ],
  products: [
    .executable(name: "vela-desktop-shell", targets: ["VelaShell"]),
  ],
  targets: [
    .executableTarget(
      name: "VelaShell",
      path: "Sources/VelaShell",
      exclude: [
        "README.md",
      ],
      resources: [
        .copy("Resources/preload.js"),
      ]
    ),
  ]
)
