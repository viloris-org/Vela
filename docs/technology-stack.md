# Technology Stack

Preferred stack for New_Vela and the main alternatives. Goal: reinforce
WebView-first UI, Qt-class composition, Bun desktop host, and portable
contracts.

## Selection rules

- Prefer mature platform WebView and windowing stacks over reimplementing browsers.
- Keep third-party deps behind Vela-owned boundaries (`@vela/api`, Shell, plugins).
- Do not expose host-private types from the public contract package.
- Prefer active maintenance, clear licensing, and explicit platform support.
- Missing OS capabilities must produce diagnostics, not silent failure.
- Avoid forcing a full Chromium+Node surface when a system WebView + Bun host
  is enough for the product class.

## Current repository stack

| Layer | Choice | Status |
|-------|--------|--------|
| Contracts | TypeScript + Bun test runner | **Shipped** (`@vela/api`) |
| Workspace | Bun workspaces | **Shipped** |
| Desktop orchestration | Bun host | Planned |
| Native shell | Platform native (Swift / C++/Rust TBD / WinRT) | Planned |
| Primary UI | System WebView (WKWebView, WebView2, …) | Planned |
| Materials | Platform APIs (Liquid Glass, Mica, …) | Planned |
| Mobile host | Swift / Kotlin + shared contracts | Planned |

## Recommended desktop path

### Bun host

- App lifecycle, plugin load, capability enforcement, packaging hooks
- Talks to Native Shell via typed RPC (ADR TBD)
- Builds/bundles web assets; not the mobile in-process JS engine

### Native Shell

- Window creation, chrome, multi-layer composition
- Hit router (single delivery)
- WebView embed + preload injection
- Material backends + native component factories

### Web UI

- Any web stack (React, Vue, Svelte, Solid, vanilla)
- Talks only through `window.vela` preload bridge

## Platform WebView expectations

| Platform | WebView | Notes |
|----------|---------|--------|
| macOS | WKWebView | Hit routing vs NSView siblings is critical |
| Windows | WebView2 | Composition + materials (Mica/Acrylic) |
| Linux | WebKitGTK or similar | Materials best-effort; Tier 2 |
| iOS | WKWebView | Same contracts; native host orchestration |
| Android | System WebView | Same contracts; native host orchestration |

## Materials backends

| Platform | Backend direction |
|----------|-------------------|
| Apple | SwiftUI `glassEffect` / AppKit-UIKit hosting / Liquid Glass APIs |
| Windows | System composition (Mica, Acrylic) |
| Linux | GTK blur / compositor-dependent |
| Fallback | `fallback.css` (`backdrop-filter` etc.) |

## Alternatives considered

### Full Electron

Pros: mature ecosystem. Cons: heavy; weak true multi-native sibling composition;
does not match Bun-first orchestration goal as cleanly. Bundled Chromium means
app vendors own WebView patch lag (Tauri documents the opposite choice).

### Pure Flutter / pure Qt

Pros: strong native composition (masks, stacking, foreign windows — see
[Qt composition notes](qt-composition-notes.md)). Cons: not WebView-first;
different authoring model than the intended product class.

### Sibling Rust `Vela` (wgpu retained GUI)

Different product: no WebView core, GPU-heavy tool UIs. Useful as documentation
structure and GUI-quality bar, not as the runtime.

### Tauri 2

**Reference, not dependency.** Adopt:

| Borrow | Why |
|--------|-----|
| System WebView (not Chromium embed) | Size + OS security update path |
| Core vs WebView privilege split | Least privilege / crash isolation |
| Commands + events message pass | Safer than FFI from page JS |
| Permissions → capabilities → runtime check | Default-deny, scoped grants |
| Plugin packaging with permission files | Extensible without bloating core |

**Do not adopt as product shape:** Rust-only Core, command-bridge-only UI, or
WRY/TAO as mandatory window stack. Vela’s differentiators remain layers,
materials, and regional hit. Full map: [Tauri comparison](tauri-comparison.md).

## Dependencies policy (contracts package)

`@vela/api` remains **dep-free** at runtime. Hosts and plugins may add Zod,
platform SDKs, etc., behind their own package boundaries.

## Open stack decisions (record when fixed)

- [ ] Shell implementation language(s) per OS (Swift-only macOS vs shared Rust core)
- [ ] Exact Bun ↔ Shell IPC transport (stdio, unix socket, embedded) — ADR 0002
- [ ] Whether to add an isolation-style interceptor between page and privilege
- [ ] Linux WebView + blur stack baseline
- [ ] Android host packaging (Activity / WebView integration pattern)
- [ ] Packaging format and custom scheme asset pipeline (Phase 2)
