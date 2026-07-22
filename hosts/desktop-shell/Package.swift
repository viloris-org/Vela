// swift-tools-version: 5.9
//
// STUB — not a buildable package yet.
// Real VelaShell targets will be added on macOS with Xcode.
// Do not expect `swift build` to succeed from this file alone.
//
// Planned (Phase 1 spike):
//   .executableTarget / .library name: "VelaShell"
//   path: "Sources/VelaShell"
//   platforms: [.macOS(.v14)] or higher for Liquid Glass paths
//
// See README.md and docs/macos-spike-architecture.md.

import PackageDescription

let package = Package(
  name: "VelaShell",
  platforms: [
    .macOS(.v14),
  ],
  products: [
    // Placeholder product name only — no targets until Swift sources land.
    // .library(name: "VelaShell", targets: ["VelaShell"]),
  ],
  targets: [
    // .target(name: "VelaShell", path: "Sources/VelaShell"),
  ]
)
