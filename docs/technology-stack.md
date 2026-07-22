# Technology stack

> **Type**: Reference  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Stack choices; open decisions listed in this page and ADRs

Preferred stack for New_Vela and the main alternatives. Goal: reinforce WebView-first UI, Qt-class composition, Bun desktop host, and portable contracts.

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
| Capability plugins (default) | TypeScript on Bun (`vela.call` handlers) | Planned ([ADR 0006](adr/0006-ts-first-capabilities.md)) |
| Perf capability kernels (optional) | **Zig** (or other native) behind Bun TS facade | Planned (ADR 0006 D9) |
| Desktop interop / control plane | **Zig** (RPC framing, dispatch, C ABI to L4) | Planned ([ADR 0005](adr/0005-zig-interop-layer.md)) |
| Native shell backends (L4) | Platform native (Swift / Win / Linux toolkits) | Planned (macOS scaffold started) |
| Primary UI | System WebView (WKWebView, WebView2, …) | Planned |
| Materials | Platform APIs (Liquid Glass, Mica, …) | Planned |
| Mobile host | Swift / Kotlin + shared contracts | Planned (Zig not required for mobile v1) |

## Recommended desktop path

### Bun host

- App lifecycle, plugin load, capability enforcement, packaging hooks
- **Default home for capability plugins** written in TypeScript ([ADR 0006](adr/0006-ts-first-capabilities.md))
- May load **T1.5 perf modules** (Zig preferred) via narrow ABI after cap checks
- Talks to Shell via typed RPC → Zig interop (ADR 0002, ADR 0005)
- Builds/bundles web assets; not the mobile in-process JS engine

### Zig interop (desktop Shell process)

- Listens for Bun on Unix domain socket / named pipe (ADR 0002 envelopes)
- Dispatches Shell control methods
- Exposes / consumes a stable **C ABI** toward L4 backends
- Optional pure ports of hit/geometry helpers when drift cost is proven
- Does **not** own toolkit widgets or system material paint
- Does **not** replace capability perf plugins (those are separate T1.5 modules)
- See [ADR 0005](adr/0005-zig-interop-layer.md)

### Zig perf modules (optional, Bun side)

- Owned by a capability plugin package, not by `zig-shell` by default
- Called only from privileged Bun TS handlers after permission checks
- Preferred first-party native language for new hot-path kernels
- Other languages OK when exposing the same narrow ABI (vendor SDKs, existing libs)
- See [ADR 0006 D9](adr/0006-ts-first-capabilities.md#d9---zig-performance-modules-behind-ts)

### Native Shell backends (L4)

- Window creation, chrome, multi-layer composition (platform toolkit)
- Hit router entry points (single delivery; semantics from `@vela/api`)
- WebView embed + preload injection
- Material backends + native component factories
- Linked into the Shell process behind Zig’s C ABI (Phase 2+)

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

Pros: mature ecosystem. Cons: heavy; weak true multi-native sibling composition; does not match Bun-first orchestration goal as cleanly. Bundled Chromium means app vendors own WebView patch lag (Tauri documents the opposite choice).

### Pure Flutter / pure Qt

Pros: strong native composition (masks, stacking, foreign windows - see [Qt composition notes](research/qt-composition-notes.md)). Cons: not WebView-first; different authoring model than the intended product class.

### Sibling Rust `Vela` (wgpu retained GUI)

Different product: no WebView core, GPU-heavy tool UIs. Useful as documentation structure and GUI-quality bar, not as the runtime.

### Tauri 2

**Reference, not dependency.** Adopt:

| Borrow | Why |
|--------|-----|
| System WebView (not Chromium embed) | Size + OS security update path |
| Core vs WebView privilege split | Least privilege / crash isolation |
| Commands + events message pass | Safer than FFI from page JS |
| Permissions → capabilities → runtime check | Default-deny, scoped grants |
| Plugin packaging with permission files | Extensible without bloating core |

**Do not adopt as product shape:** Rust-only Core, command-bridge-only UI, or WRY/TAO as mandatory window stack. Vela’s differentiators remain layers, materials, and regional hit. Full map: [Tauri comparison](research/tauri-comparison.md). Cross-host shape: [ADR 0004](adr/0004-cross-platform-abstraction.md).

### Zig vs shared Rust UI core

Zig is chosen for **interop**, not as a WRY/TAO-class window stack. A shared
Rust **UI** core remains rejected (ADR 0004). A shared Rust **interop** core is
unnecessary once Zig owns framing/dispatch/C ABI (ADR 0005).

## Dependencies policy (contracts package)

`@vela/api` remains **dep-free** at runtime. Hosts and plugins may add Zod, platform SDKs, etc., behind their own package boundaries.

## Cross-platform Shell strategy

**Decision (ADR 0004):** contracts-first, **multi-backend Shell**. There is no
mandatory shared Rust/Chromium UI core. Each OS implements the Shell **role**
(window, WebView, layer tree, hit router, materials, factories, control plane)
against `@vela/api`. Conceptual map:
[Cross-platform abstraction](cross-platform-abstraction.md).

**Decision (ADR 0005):** desktop Phase 2+ uses **Zig** as the shared interop /
control-plane between Bun and L4 backends. Zig is not a UI toolkit.

```text
Bun (TS)  --UDS/pipe RPC-->  Zig  --C ABI-->  L4 (Swift / Win / Linux)
```

| Platform | Interop | L4 backend language (intent) | Notes |
|----------|---------|------------------------------|--------|
| macOS | Zig (Phase 2+; optional in Phase 1) | Swift | Phase 1 may be Swift-only spike |
| Windows | Zig | Native at Phase 4 start | C++/WinRT or Rust+WinRT — pick when host starts |
| Linux | Zig | Native TBD | WebView + blur baseline still open |
| iOS | Not required | Swift | Native host orchestration |
| Android | Not required | Kotlin | Packaging pattern still open |

Optional pure hit/geometry code may live in Zig when host-mirror drift cost is
proven. It must not become the public composition API or the sole window stack.

## Open stack decisions (record when fixed)

- [x] Phase 1 macOS Shell language: **Swift** (AppKit + SwiftUI hosting for glass) - [macos-spike-architecture.md](macos-spike-architecture.md)
- [x] Bun ↔ Shell IPC transport (Phase 2): **Unix domain socket / Windows named pipe + JSON envelopes** - [ADR 0002](adr/0002-ipc-privilege.md)
- [x] Page → privilege: **message pass only** (no FFI from page) - ADR 0002 D1
- [x] Phase 1 process topology: **single Shell process allowed**; Bun split is Phase 2 - ADR 0002 D2
- [x] Multi-OS Shell shape: **per-platform backends + shared contracts** (not mandatory shared Rust UI core) - [ADR 0004](adr/0004-cross-platform-abstraction.md)
- [x] Desktop Bun↔native middle layer: **Zig** interop (RPC + C ABI; not UI core) - [ADR 0005](adr/0005-zig-interop-layer.md)
- [x] Capability authoring default: **TypeScript on Bun host**; native optional for T2 - [ADR 0006](adr/0006-ts-first-capabilities.md)
- [ ] Windows L4 language (C++/WinRT vs Rust+WinRT) at Phase 4 start
- [ ] Zig C ABI header surface (`vela_shell_*` groups) checked in with `hosts/zig-shell`
- [ ] Isolation-style interceptor between page and privilege (optional Phase 2+; ADR 0002 D7)
- [ ] Linux WebView + blur stack baseline
- [ ] Android host packaging (Activity / WebView integration pattern)
- [ ] Packaging format and custom scheme asset pipeline (Phase 2)
