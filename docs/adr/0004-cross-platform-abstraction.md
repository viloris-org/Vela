# ADR 0004: Cross-platform Shell abstraction

> **Type**: Decision  
> **Status**: Accepted decision (doc current)  
> **Audience**: Maintainers | Host implementers  
> **SoT**: Binding decisions for multi-platform Shell shape; product types remain `@vela/api`

- **Status**: Accepted
- **Date**: 2026-07-22
- **Deciders**: Project maintainers

## Context

Vela targets desktop (macOS, Windows, Linux) and mobile (iOS, Android) with one
authoring model: WebView-first UI, Qt-class multi-layer composition, regional
hit-through, system materials, and default-deny capabilities.

`@vela/api` already carries portable types and pure helpers (`Layer`,
`resolveHit`, `resolveMaterial`, RPC envelopes, capabilities). Phase 1 locks
macOS Shell language to **Swift**. Open stack debt (from
[technology-stack](../technology-stack.md)) still asked:

> Shared Rust core for multi-OS Shell vs per-OS native (Windows/Linux language TBD)

If we answer that wrong, we either:

- force a lowest-common-denominator window stack (WRY/TAO-class) and lose
  first-class materials / regional hit quality, or
- fork public contracts per host and break app portability.

[ADR 0001](0001-composition-hit-material.md) fixed composition truth.
[ADR 0002](0002-ipc-privilege.md) fixed trust boundaries and desktop process
topology. This ADR fixes **what is shared across OS** and **what stays
platform-private**.

## Decisions

### D1 - Contracts-first portability

The **only** required shared language across hosts is `@vela/api` plus Accepted
ADRs:

| Shared (portable) | Not shared (platform-private) |
|-------------------|-------------------------------|
| Layer tree types and `InsertLayerSpec` | `NSView` / HWND / GTK / UIView / Android `View` trees |
| `HitPolicy`, `WindowInputMode`, `resolveHit` semantics | OS hit-test entry points and event loops |
| `MaterialId` + `resolveMaterial` policy | Liquid Glass / Mica / Acrylic / gtk blur paint |
| RPC envelopes, bridge channels, capability ids | Socket path layout, named-pipe names, OS permission UI |
| Logical geometry + `WindowState.scaleFactor` | Physical pixel conversion, DPI quirks |

Hosts may differ in **implementation quality and feature tier**, not in public
type surface. App code must not import host-private types.

### D2 - Shell is a role, not a single binary or crate

**Shell** means: windowing, WebView embed, layer tree, hit router, materials,
signed native factories. It is a **responsibility boundary**, not “one Rust
crate for all OS”.

| Host family | Orchestration | Shell implementation |
|-------------|---------------|----------------------|
| Desktop Phase 1 | Optional / in-process | Single native process (macOS Swift spike) |
| Desktop Phase 2+ | Bun host process | Native Shell process per OS family |
| Mobile | Native host (Swift / Kotlin) | Same process or tight native split; **no** in-process Bun app runtime |

Bun remains desktop orchestration + CI/tooling. Mobile implements the same
Layer / Capability / bridge protocol without embedding Bun as the UI runtime.

### D3 - Multi-backend Shell, not a mandatory shared UI core

**Chosen:** per-platform Shell backends that implement the Shell role against
`@vela/api` and the Shell control protocol (Phase 2 RPC).

**Rejected as mandatory product shape:**

| Option | Why rejected as default |
|--------|-------------------------|
| Shared Rust UI core (WRY/TAO-style) for all Shells | Collapses composition differentiators into a thin WebView wrapper; materials and regional hit need deep toolkit access |
| One codebase / one language for every Shell | Fights platform best path (Swift glass, Win composition, Android View); raises delivery cost without app-facing gain |
| App-visible platform forks of `@vela/api` | Breaks one-authoring-model promise |

**Allowed later (optional, not required to start Windows/Linux):**

- Shared **pure** native library for geometry / region tests if host mirrors of
  `resolveHit` drift and the cost is proven.
- Shared packaging or code-signing helpers that never own window hit policy.

**Desktop control plane (fixed by [ADR 0005](0005-zig-interop-layer.md)):**

- **Zig** owns Bun↔Shell RPC framing/dispatch and the C ABI into L4 backends.
- That is a shared **interop** core, not a shared **UI toolkit** core.
- Phase 1 may omit Zig; Phase 2+ desktop requires it.

Any shared native helper must stay **below** app-facing contracts and must not
become the sole public composition API.

### D4 - Platform backend map (languages and toolkits)

| Platform | Shell language (intent) | WebView | Materials direction |
|----------|-------------------------|---------|---------------------|
| macOS | **Swift** (AppKit + SwiftUI hosting) | WKWebView | Liquid Glass / `apple.material` |
| iOS | **Swift** | WKWebView | System materials + degrade |
| Windows | **Native** (C++/WinRT or Rust+WinRT; choose at Phase 4 start) | WebView2 | Mica / Acrylic / smoke |
| Linux | **Native** (language TBD with WebView stack) | WebKitGTK or documented peer | `gtk.blur` best-effort |
| Android | **Kotlin** | System WebView | `fallback.css` first; native material later |

Windows and Linux language choices are **deferred to host-start ADRs or stack
updates**, not reopened for macOS/iOS. Phase 1 remains Swift-only.

### D5 - Port surface: same jobs, platform glue

Every Shell backend must provide these jobs (names are conceptual; wire shapes
live in `@vela/api` protocol modules):

1. **Window** - create, show, resize, DPI/scale, focus, close; map
   `WindowInputMode`.
2. **WebView** - embed system WebView; inject preload (`window.vela` whitelist).
3. **Layer tree** - apply insert/update/remove from contract specs; z-order is
   draw and hit truth.
4. **Hit router** - single delivery; semantics match `resolveHit` (native may
   mirror the pure algorithm).
5. **Materials** - resolve via `resolveMaterial` policy; paint with platform
   APIs; report `degraded` + reason.
6. **Native factories** - host signed components behind capability checks.
7. **Control plane** - Phase 1 local bridge; Phase 2 Bun↔Shell RPC per ADR 0002.

Forbidden:

- Page JS calling OS toolkits or FFI.
- Opacity implying hit policy.
- Double-delivery of pointer events to WebView and sibling native views.
- Shipping host-private types from `@vela/api`.

### D6 - Drift control and conformance

To keep multi-backend Shells aligned:

1. **Pure algorithms in `@vela/api`** with unit tests are the semantic SoT for
   hit, material resolve, generation, and logical coordinates.
2. **Host mirrors** (e.g. Swift `resolveHit`) must match pure tests; when they
   diverge, fix the host or raise an ADR if the pure rule is wrong.
3. **Acceptance scenarios** ([testing-and-acceptance](../testing-and-acceptance.md))
   are the cross-host fitness function (S1–S7 class, then W1–W3, then mobile
   subset).
4. **Same dogfood web package** runs on each host with platform material
   fallbacks only.
5. **Feature tiers** stay in [platform-support](../platform-support.md); missing
   capability must fail loudly, not silently look like another OS.

### D7 - Evolution order

1. Prove Shell role on macOS (Phase 1) against contracts.
2. Stabilize Bun↔Shell RPC (Phase 2) without inventing a second public API.
3. Add Windows backend implementing the same jobs (Phase 4).
4. Linux and mobile follow the same role map; do not invent parallel product
   packages.

Do **not** wait for a universal Shell core before Phase 1 or Phase 4.

## Consequences

### Positive

- App authors keep one TypeScript contract surface.
- Each OS can use the toolkit that delivers true materials and correct hit
  routing.
- Matches existing macOS Swift decision and Tauri research stance: borrow
  security mindset, not a mandatory window crate.
- Drift is controlled by pure tests + acceptance, not by hoping one core fits
  all.

### Negative / costs

- Multiple Shell codebases (Swift, then Windows, then Linux/mobile).
- Host implementers must re-implement the Shell job list carefully.
- Risk of subtle hit/material divergence without discipline on D6.

### Mitigations

- Keep Shell modules split by responsibility (window, webview, layers, hit,
  materials) inside each host tree.
- Prefer porting pure-test cases over inventing per-OS policy forks.
- Record Windows/Linux language picks when those hosts start, without changing
  D1–D3.

## Alternatives considered

### A - Shared Rust Shell core for all desktop OS

Pros: one IPC and window abstraction; familiar Tauri-shaped stack.  
Cons: fights Swift Liquid Glass and deep AppKit hit ownership; tends toward
“WebView + commands” product, which is not Vela’s differentiator.  
Verdict: **rejected as mandatory**. Optional pure helpers only (D3).

### B - Electron-class single Chromium embed everywhere

Pros: uniform rendering.  
Cons: heavy; weak true sibling native composition; contradicts system-WebView
choice.  
Verdict: **rejected**.

### C - Separate public packages per platform (`@vela/api-macos`, …)

Pros: can encode OS-only fields.  
Cons: app portability collapses; web code branches on host packages.  
Verdict: **rejected**. Platform fields stay inside host-private code or
optional capability/feature detection, not forked public layer types.

## References

- [Cross-platform abstraction](../cross-platform-abstraction.md) - conceptual map
- [Architecture](../architecture.md)
- [Technology stack](../technology-stack.md)
- [Platform support](../platform-support.md)
- [macOS spike architecture](../macos-spike-architecture.md)
- [ADR 0001](0001-composition-hit-material.md) - composition / hit / materials
- [ADR 0002](0002-ipc-privilege.md) - IPC and privilege
- [Tauri comparison](../research/tauri-comparison.md) - security mindset, not runtime
