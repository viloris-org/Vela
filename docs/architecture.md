# Architecture

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers | Maintainers  
> **SoT**: `@vela/api` and Accepted ADRs; this page explains the product shape

Vela (this repository: **New_Vela**) is a Bun-centered GUI framework for **desktop and mobile** applications that need:

- Web productivity for the main UI surface
- Strong native shell control (windowing, chrome, permissions)
- **Qt-class composition**: multi-layer stacking with **regional** hit-through
- First-class **system materials** (Liquid Glass, Mica, Acrylic, …)
- A default-deny **Capability** model for system APIs

> Status: architecture + shared TypeScript contracts (`@vela/api`). Host implementations (Bun desktop, native shell, iOS/Android) are not shipped yet. See [Roadmap](roadmap.md).

## Positioning

| System | Model | Gap Vela addresses |
|--------|--------|--------------------|
| Electron | Chromium + Node; overlays are awkward | Heavy; weak true native sibling composition |
| Flutter desktop | Mostly whole-window mouse ignore | Regional holes between Web / native / material |
| [Tauri](https://v2.tauri.app/) | System WebView + Rust Core + commands/events + capabilities | Composition/materials/regional hit not first-class |
| Qt Widgets / Quick | Stacking, masks, partial event transparency | Not WebView-first; not Bun host |
| Sibling `Vela` (Rust/wgpu) | Retained native + GPU viewports | Different product: no WebView core |

Vela takes **Qt-like composition philosophy** (layer stack, masks, transparent for mouse events) and pairs it with **WebView-first authoring** and a **Bun** desktop orchestration host. See [Qt composition notes](research/qt-composition-notes.md).

From **Tauri 2** we adopt the *security and process mindset* (least privilege, message-pass IPC, capability grants, system WebView - not bundled Chromium), not the runtime. Full map: [Tauri comparison](research/tauri-comparison.md).

## High-level split

```text
Application (TS / web assets)  -- least privilege --
        |
        | window.vela preload (call / layers / hit / events)
        v
+-------------------+     +------------------+     +------------------------+
|  Bun host         |---->|  Zig interop     |---->|  Platform backend (L4) |
|  (desktop)        | RPC |  framing,        | C   |  window, WebView,      |
|  plugins, caps,   |<----|  dispatch, ABI   | ABI |  layers, hit, materials|
|  app lifecycle    |     |  (Shell process) |     |  signed native factories|
+-------------------+     +------------------+     +------------------------+
        |                        |                            |
        | shared contracts       | desktop control plane      | toolkit-private
        v                        v                            v
  packages/api (@vela/api)   hosts/zig-shell/          Swift / Win / Linux / …
```

Phase 1 may collapse Zig and use a single Swift process with a local preload
bridge. Phase 2+ desktop requires Bun → Zig RPC → L4. Mobile keeps native
orchestration without requiring Zig. See [ADR 0005](adr/0005-zig-interop-layer.md).

| Role | Desktop | Mobile (v1 intent) |
|------|---------|---------------------|
| Orchestration, capabilities, plugins | **Bun host** | Native host (Swift/Kotlin); same TS contracts |
| Control plane / Bun↔native glue | **Zig interop** (Phase 2+) | Optional later; not required for mobile v1 |
| Windowing, WebView, layers, hit router | **Shell role** via L4 backend | Same Shell role, native host |
| System materials | Platform native (e.g. Swift Liquid Glass) | Platform native |
| Main application UI | WebView layer(s) | WebView layer(s) |

Bun is **not** the in-process JS engine for full app runtime on iOS/Android. Mobile hosts implement the same Layer / Capability / bridge protocol; bundles are produced with Bun on CI/dev machines.

### Trust boundaries (Tauri-aligned)

| Zone | Privilege | May do |
|------|-----------|--------|
| WebView page JS | Least | Only `window.vela`; no Node, no FFI, no secrets |
| Bun host | Medium - high | Capability catalog, plugin load, app lifecycle, packaging |
| Zig interop (desktop Shell process) | High (with Shell) | RPC endpoint, dispatch, C ABI to L4; no page access |
| Native Shell / L4 backend | Highest OS surface | Windowing, embed WebView, hit router, materials, signed natives |

All privileged entry from the page is **async message passing**. The privileged side may reject any request. Bun and Shell **both** enforce capability checks (defense in depth). Compare Tauri Core filtering IPC: [process model](https://v2.tauri.app/concept/process-model/), [security](https://v2.tauri.app/security/).

## Design principles

1. **Layer tree is composition truth** - a WebView is one layer kind, not the
sole content root.
2. **Two-level input** - window→OS (`WindowInputMode`) is distinct from
layer↔layer (`HitPolicy`). Never conflate them.
3. **Shell owns hit routing** - no double-delivery of pointer events to WebView
and sibling native views (known WKWebView + NSView failure mode).
4. **Materials are layers** - real system materials sample live surfaces in the
window compositor; CSS `backdrop-filter` is only `fallback.css`.
5. **Default deny** - capabilities granted via app manifest; sensitive native
layers require matching permissions (Tauri-style capability grants).
6. **Whitelist bridge** - preload exposes `call` / `layers` / `hit` / `events`
only; no Node integration, no raw FFI from page JS (message pass, not FFI).
7. **Shared contracts** - `@vela/api` is the cross-host language; hosts may
differ in implementation quality, not in type surface.
8. **System WebView, not bundled Chromium** - smaller binary; OS-updated
renderer (same tradeoff Tauri documents).
9. **Contracts-first multi-backend Shell** - Shell is a **role** (window,
WebView, layers, hit, materials), implemented per OS with native toolkits. No
mandatory shared Rust/Chromium UI core; no app-visible per-OS contract forks.
See [Cross-platform abstraction](cross-platform-abstraction.md) and
[ADR 0004](adr/0004-cross-platform-abstraction.md).
10. **Zig desktop interop** - Bun reaches platform backends through a Zig
control plane (RPC + C ABI), not through Bun FFI into toolkits and not through
page-visible native bindings. See [ADR 0005](adr/0005-zig-interop-layer.md).
11. **TypeScript-first capabilities** - most non-UI system APIs are written as
privileged Bun/TS handlers behind `vela.call`. Native and other languages are
optional bridges for toolkit UI, materials, or foreign ABIs. **Hot paths** may
use Zig (or other native) kernels behind the same TS `call` surface (T1.5).
Apps always stay on the whitelist bridge. See [ADR 0006](adr/0006-ts-first-capabilities.md).

## Cross-platform abstraction (summary)

Portability sits in **L1 contracts** and the **L3 Shell job list**, not in one
universal window crate:

| Layer | Portable surface |
|-------|------------------|
| App (L0) | `window.vela` only |
| Contracts (L1) | `@vela/api` types + pure helpers |
| Orchestration (L2) | Bun desktop host; native mobile host; same protocol |
| Zig interop (L2.5) | Desktop RPC, dispatch, C ABI (not UI toolkit) |
| Shell role (L3) | Same jobs on every OS |
| Backend (L4) | Swift / Win / Linux / mobile toolkit code |

Drift control: pure unit tests in `@vela/api`, host mirrors of `resolveHit` /
`resolveMaterial`, shared dogfood content, and acceptance scenarios. Full map:
[Cross-platform abstraction](cross-platform-abstraction.md).

## Monorepo layout (current + planned)

```text
New_Vela/
  README.md
  docs/                 Architecture, domain guides, ADRs
  packages/api/         @vela/api - types + pure helpers (usable today)
  hosts/                zig-shell (planned interop); desktop-shell (macOS L4 scaffold); more L4 later
  plugins/              (planned) camera, materials, fs, dialog, …
  apps/                 playground / dogfood (web package)
```

## Ownership boundaries

| Concern | Owner |
|---------|--------|
| Geometry, Layer, HitPolicy, MaterialId, Capability types | `@vela/api` |
| Permission checks at call time | Bun host + Shell (both enforce) |
| Draw order & hit order | Shell (zIndex) |
| Web-shaped opaque regions | Web → Shell via `vela.hit` |
| True Liquid Glass / Mica paint | Platform native backend (L4) |
| Shell job list across OS | Each L4 backend; contracts + ADR 0004 |
| Bun↔Shell desktop glue | Zig interop (ADR 0005); not page-visible |
| Non-UI capability plugins | TypeScript on Bun host by default (ADR 0006) |
| High-perf capability kernels | Optional Zig (T1.5) behind Bun TS facade |
| Native UI / materials | L4 + signed modules only when T2 required |
| Signed native component load | Shell (never arbitrary `dlopen` from page JS) |
| App UI markup / CSS / framework | App Web content (React/Vue/Svelte/… free choice) |

## Security spine

- Capabilities default **deny**; grant via manifest profiles (cf. Tauri
[capabilities](https://v2.tauri.app/security/capabilities/) / [permissions](https://v2.tauri.app/security/permissions/)).
- Creating camera (and similar) layers requires matching permissions.
- Loading unsigned native modules is off by default
(`native:load-unsigned`).
- Production content URLs: custom schemes (`app://`, `asset://`); open
localhost is not the default.
- Preload bridge is a **capability RPC + layer control surface**, not a
general Node escape hatch.
- Prefer keeping secrets and business logic out of the WebView (least
privilege); treat the page as hostile dependency surface.

IPC / typed RPC privilege boundaries: **[ADR 0002](adr/0002-ipc-privilege.md)** (Proposed). Plugin ABI and signing: planned **ADR 0003**. Cross-platform Shell shape: **[ADR 0004](adr/0004-cross-platform-abstraction.md)** (Accepted). Zig interop: **[ADR 0005](adr/0005-zig-interop-layer.md)** (Accepted). TS-first capabilities: **[ADR 0006](adr/0006-ts-first-capabilities.md)** (Accepted).

Phase 1 may run a **single Shell process** to prove composition; Phase 2 splits Bun host vs Shell over a socket. Executable macOS plan: [macOS spike architecture](macos-spike-architecture.md). Open design debt: [design gaps](design-gaps.md).

## Related documents

| Doc | Purpose |
|-----|---------|
| [Composition and layers](composition-and-layers.md) | Layer kinds, stack, insert/update |
| [Input and hit testing](input-and-hit-testing.md) | HitPolicy, WindowInputMode, web-shaped |
| [Materials](materials.md) | MaterialId, fallback, backdrop sources |
| [Capabilities and plugins](capabilities-and-plugins.md) | Permissions, TS-first plugins, native components |
| [API contracts](api-contracts.md) | `@vela/api` map |
| [Technology stack](technology-stack.md) | Host/runtime choices |
| [Platform support](platform-support.md) | Tiers and expectations |
| [Cross-platform abstraction](cross-platform-abstraction.md) | Shared contracts vs multi-backend Shell + Zig |
| [Roadmap](roadmap.md) | Phased delivery |
| [Testing and acceptance](testing-and-acceptance.md) | Host smoke gates |
| [Qt composition notes](research/qt-composition-notes.md) | Qt Widgets/Quick → Vela map |
| [Tauri comparison](research/tauri-comparison.md) | Process/IPC/security reference map |
| [macOS spike architecture](macos-spike-architecture.md) | Phase 1 view tree + hit router |
| [Design gaps](design-gaps.md) | Prioritized contract/doc debt |
| [Doc index](README.md) | Reading order and full index |
| [ADR 0001](adr/0001-composition-hit-material.md) | Accepted composition decisions |
| [ADR 0002](adr/0002-ipc-privilege.md) | IPC / privilege (Proposed) |
| [ADR 0004](adr/0004-cross-platform-abstraction.md) | Cross-platform Shell abstraction (Accepted) |
| [ADR 0005](adr/0005-zig-interop-layer.md) | Zig Bun↔native interop layer (Accepted) |
| [ADR 0006](adr/0006-ts-first-capabilities.md) | TypeScript-first capabilities (Accepted) |

## Non-goals (v1)

- Pixel-identical materials across platforms (semantic materials only).
- Per-pixel alpha hit-testing (expensive; deferred).
- Arbitrary CSS-transform-driven native hitching.
- List-cell-per-row native embedding; scroll-linked native slots (Phase 2).
- Replacing the browser layout/CSS engine inside the WebView.
- Shipping a full Rust retained GUI (that is sibling project `Vela`).
- A mandatory shared Rust/Chromium UI core for all Shells (see ADR 0004).
- App-visible per-platform forks of `@vela/api`.
- Bun in-process FFI into toolkit Shells for Phase 2+ (use Zig RPC instead).
