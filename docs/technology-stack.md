# Technology stack

> **Type**: Reference  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Stack choices; open decisions listed in this page and ADRs

Preferred stack for New_Vela and the main alternatives. Goal: reinforce WebView-first UI, Qt-class composition, TypeScript-first Host plugins, a Bun **desktop reference** host (and toolchain), and portable contracts.

## Selection rules

- Prefer mature platform WebView and windowing stacks over reimplementing browsers.
- Keep third-party deps behind Vela-owned boundaries (`@vela/api`, Shell, plugins).
- Do not expose host-private types from the public contract package.
- Prefer active maintenance, clear licensing, and explicit platform support.
- Missing OS capabilities must produce diagnostics, not silent failure.
- Avoid forcing a full Chromium+Node surface when a system WebView + privileged Host is enough for the product class.
- Choose Host JS runtimes for **DX, packaging, and API fit** — not for server-style JS throughput. App UI trusts the system WebView engine; Host hot paths use T1.5 native kernels ([ADR 0006](adr/0006-ts-first-capabilities.md) D9).

## Current repository stack

| Layer | Choice | Status |
|-------|--------|--------|
| Contracts | TypeScript + Bun test runner | **Shipped** (`@vela/api`) |
| Workspace | Bun workspaces | **Shipped** |
| Desktop orchestration | Bun = **reference** privileged Host | Planned ([ADR 0007](adr/0007-typescript-full-stack-host.md)) |
| Capability plugins (default authoring) | **Host TypeScript** (`vela.call` handlers) | Planned ([ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md)) |
| Systems / perf capability kernels | **Zig** unified surface + plugin native (default first-party) | Planned ([ADR 0008](adr/0008-zig-systems-surface.md), ADR 0006 D9) |
| Desktop interop / control plane | **Zig** (RPC framing, dispatch, C ABI to L4) | Planned ([ADR 0005](adr/0005-zig-interop-layer.md)) |
| Native shell backends (L4) | Platform native (Swift / Win / Linux toolkits) | Planned (macOS scaffold started) |
| Primary UI | System WebView (WKWebView, WebView2, …) | Planned |
| Materials | Platform APIs (Liquid Glass, Mica, …) | Planned |
| Mobile Shell | Swift / Kotlin + shared contracts | Planned (Zig not required for mobile v1) |
| Mobile Host TS backend | Pluggable (e.g. system JSC); interim native `call` shims | Planned (ADR 0007); not required for App bridge |

## Recommended desktop path

### Privileged Host (desktop reference: Bun)

- App lifecycle, plugin load, capability enforcement, packaging hooks
- **Default home for capability plugins** written in TypeScript ([ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md))
- May load **Zig systems / T1.5 modules** via narrow ABI after cap checks ([ADR 0008](adr/0008-zig-systems-surface.md))
- Talks to Shell via typed RPC → Zig interop (ADR 0002, ADR 0005)
- **Instant mode:** Bun may run as the desktop reference Host for plugin DX
- **Static / release:** Bun is **compile/bundle only** on build machines; App JS always runs in the **system WebView**; mobile packages never require Bun ([run modes](run-modes.md), [ADR 0007](adr/0007-typescript-full-stack-host.md) D7)
- Other Host backends may run the **same plugin source** (pluggable runtime); see ADR 0007
- **Not a performance pick:** typical Host work is I/O, permission checks, and RPC orchestration. Bun’s server-oriented runtime advantages are incidental; they are not a product requirement. Do not keep heavy work in Host TS solely because Bun is “fast” — use Zig systems/T1.5 when OS kernels or measurement say so.

### Web UI (App)

- Any web stack (React, Vue, Svelte, Solid, vanilla)
- Talks only through `window.vela` preload bridge
- **Always executes in the system WebView** — never under Bun as the App engine
- First-load tactics (prewarm, bytecode cache, shell HTML) live in
  [App load and startup](app-load-and-startup.md) — **not** “ship Bun for faster V8”

### Zig interop (desktop Shell process)

- Listens for Bun on Unix domain socket / named pipe (ADR 0002 envelopes)
- Dispatches Shell control methods
- Exposes / consumes a stable **C ABI** toward L4 backends
- Optional pure ports of hit/geometry helpers when drift cost is proven
- Does **not** own toolkit widgets or system material paint
- Does **not** own capability business plugins (those use Host TS + systems surface)
- See [ADR 0005](adr/0005-zig-interop-layer.md)

### Zig systems surface and plugin kernels (Host side)

- **Primary motive:** maintainability — one systems dialect and interface family so capabilities do not scatter across Swift/Kotlin/C++ author paths ([ADR 0008](adr/0008-zig-systems-surface.md))
- Shared library intent: `libs/vela-sys` (name TBD) for portable OS/hot-path APIs
- Plugin-owned kernels under `plugins/*/native` for feature-specific work
- Called only from privileged Host TS handlers after permission checks
- Preferred first-party native language for new Vela-owned systems code
- Other languages OK when exposing the same narrow ABI family (vendor SDKs, existing libs)
- Platform-exclusive UI/materials stay L4; no false pixel unification
- Accept a thicker unified surface rather than multi-language thin bridges
- See [ADR 0006 D9](adr/0006-ts-first-capabilities.md#d9---zig-performance-and-systems-modules-behind-ts), [ADR 0008](adr/0008-zig-systems-surface.md)

### Native Shell backends (L4)

- Window creation, chrome, multi-layer composition (platform toolkit)
- Hit router entry points (single delivery; semantics from `@vela/api`)
- WebView embed + preload injection
- Material backends + native component factories
- Linked into the Shell process behind Zig’s C ABI (Phase 2+)

## Platform WebView expectations

| Platform | WebView | Notes |
|----------|---------|--------|
| macOS | WKWebView | Hit routing vs NSView siblings is critical |
| Windows | WebView2 | Composition + materials (Mica/Acrylic) |
| Linux | **WebKitGTK 6.0** (GTK4) | Tier 2; baseline locked ([linux-spike-architecture.md](linux-spike-architecture.md)); older WebKit2GTK 4.1 not dual-maintained in v1 |
| iOS | WKWebView | Same contracts; native host orchestration |
| Android | System WebView | Same contracts; native host orchestration |

## Materials backends

| Platform | Backend direction |
|----------|-------------------|
| Apple | SwiftUI `glassEffect` / AppKit-UIKit hosting / Liquid Glass APIs |
| Windows | System composition (Mica, Acrylic) |
| Linux | `gtk.blur` best-effort (snapshot / compositor window-behind) or loud degrade → translucent / `fallback.css` |
| Fallback | `fallback.css` (`backdrop-filter` etc.) |

## Alternatives considered

### Full Electron

Pros: mature ecosystem. Cons: heavy; weak true multi-native sibling composition; does not match TypeScript-first Host + system WebView as cleanly. Bundled Chromium means app vendors own WebView patch lag (Tauri documents the opposite choice).

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

Zig is chosen for **interop** and for the **default first-party systems surface**
([ADR 0005](adr/0005-zig-interop-layer.md), [ADR 0008](adr/0008-zig-systems-surface.md)),
not as a WRY/TAO-class window stack. A shared Rust **UI** core remains rejected
(ADR 0004). A shared Rust **interop** core is unnecessary once Zig owns
framing/dispatch/C ABI (ADR 0005). Capability systems code defaults to the same
Zig dialect so plugins do not scatter across native languages (ADR 0008).

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
Host TS (desktop ref: Bun)  --UDS/pipe RPC-->  Zig  --C ABI-->  L4 (Swift / Win / Linux)
```

| Platform | Interop | L4 backend language (intent) | Notes |
|----------|---------|------------------------------|--------|
| macOS | Zig (Phase 2+; optional in Phase 1) | Swift | Phase 1 may be Swift-only spike |
| Windows | Zig | Native at Phase 4 start | C++/WinRT or Rust+WinRT — pick when host starts |
| Linux | Zig | **GTK4 + WebKitGTK 6.0** (`hosts/linux-shell`) | Spike may be single-process; Phase 2 wires Zig C ABI |
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
- [x] Capability authoring default: **TypeScript on privileged Host**; desktop reference runtime Bun; native optional for T2 - [ADR 0006](adr/0006-ts-first-capabilities.md), [ADR 0007](adr/0007-typescript-full-stack-host.md)
- [x] Performance story: **system WebView for App**; **T1.5 native for Host hot paths**; Bun not selected for server-style JS throughput - ADR 0007 D8
- [x] Run modes: **instant** (dev; Bun Host OK) vs **static** (Bun compile-only; App JS in WebView) - [run-modes.md](run-modes.md), ADR 0007 D7
- [ ] Windows L4 language (C++/WinRT vs Rust+WinRT) at Phase 4 start

- [~] Zig C ABI header surface (`vela_shell_*` groups) checked in with `hosts/zig-shell` (header + mock vtable + codec; UDS/real L4 open)
- [ ] Isolation-style interceptor between page and privilege (optional Phase 2+; ADR 0002 D7)
- [x] Linux WebView + blur stack baseline: **GTK4 + WebKitGTK 6.0**, `gtk.blur` best-effort - [linux-spike-architecture.md](linux-spike-architecture.md)
- [ ] Android host packaging (Activity / WebView integration pattern)
- [ ] Packaging format and custom scheme asset pipeline (Phase 2)
