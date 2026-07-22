# Cross-platform abstraction

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers | App authors  
> **SoT**: [ADR 0004](adr/0004-cross-platform-abstraction.md), [ADR 0005](adr/0005-zig-interop-layer.md); types in `@vela/api`

How Vela stays portable across desktop and mobile without a single shared UI
runtime. This page maps **layers of abstraction**, what each layer owns, and
what must never leak across boundaries.

Binding decisions: [ADR 0004](adr/0004-cross-platform-abstraction.md),
[ADR 0005](adr/0005-zig-interop-layer.md). Composition rules:
[ADR 0001](adr/0001-composition-hit-material.md). Privilege and IPC:
[ADR 0002](adr/0002-ipc-privilege.md).

## Summary

Vela is **contracts-first** and **multi-backend**:

1. Apps author against `@vela/api` and `window.vela` only.
2. **Shell** is a **role** (window, WebView, layers, hit, materials), not one
   binary for every OS.
3. Each platform implements that role with its best native toolkit.
4. On desktop Phase 2+, **Zig** is the portable **interop / control-plane**
   between Bun and those backends (C ABI). Zig does not own UI toolkits.
5. Pure algorithms and acceptance scenarios keep backends aligned.

We do **not** require a shared Rust/Chromium UI core. We do **not** fork public
packages per OS. Binding placement of Zig: [ADR 0005](adr/0005-zig-interop-layer.md).

## Abstraction stack

```text
┌─────────────────────────────────────────────────────────────┐
│  L0  Application (TS / web assets)                          │
│      only window.vela  ·  no Node, no FFI, no host types    │
└────────────────────────────┬────────────────────────────────┘
                             │ preload bridge (call/layers/hit/events)
┌────────────────────────────▼────────────────────────────────┐
│  L1  Contracts — packages/api (@vela/api)                     │
│      Layer · Hit · Material · Capability · RPC · pure helpers │
└───────────────┬─────────────────────────────┬─────────────────┘
                │                             │
┌───────────────▼───────────────┐   ┌─────────▼─────────────────┐
│  L2a Desktop orchestration    │   │  L2b Mobile orchestration │
│  Bun host (Phase 2+)          │   │  Swift / Kotlin host      │
│  lifecycle, caps, plugins     │   │  same protocol subset     │
└───────────────┬───────────────┘   └─────────┬─────────────────┘
                │ UDS / pipe RPC              │ in-process / native
                │ (ADR 0002)                  │
┌───────────────▼───────────────┐             │
│  L2.5 Zig interop (desktop)   │             │
│  framing · dispatch · C ABI   │             │
│  optional pure hit/geometry   │             │
└───────────────┬───────────────┘             │
                │ C ABI (Shell-internal)      │
┌───────────────▼─────────────────────────────▼─────────────────┐
│  L3  Shell role (portable jobs; Zig dispatches on desktop)     │
│      window · webview · layer tree · hit router · materials    │
│      · native factories · control plane                        │
└───────────────┬─────────────┬─────────────┬───────────────────┘
                │             │             │
        ┌───────▼───┐  ┌──────▼────┐  ┌─────▼──────┐
        │ L4 macOS  │  │ L4 Win    │  │ L4 Linux / │
        │ Swift     │  │ WebView2  │  │ mobile …   │
        │ AppKit+   │  │ + DWM     │  │ native TK  │
        └───────────┘  └───────────┘  └────────────┘
```

| Layer | What it is | Who consumes it |
|-------|------------|-----------------|
| **L0 App** | Web UI + least privilege | App authors |
| **L1 Contracts** | Types + pure helpers | Everyone; SoT for semantics |
| **L2 Orchestration** | Capabilities, plugins, lifecycle, packaging | Host implementers; **capability plugins default to TS** ([ADR 0006](adr/0006-ts-first-capabilities.md)) |
| **L2.5 Zig interop** | Desktop control plane: RPC, dispatch, C ABI to L4 | Desktop host implementers |
| **L3 Shell role** | Composition and OS surface jobs | Host implementers |
| **L4 Backend** | Toolkit-specific views and paint | Platform engineers only |

### Dependency rules

| From → To | Allowed? |
|-----------|----------|
| L0 → L1 types (compile-time / docs) | Yes |
| L0 → L2/L3/L4 private APIs | **No** |
| L2 → L1 | Yes |
| L2a Bun → L2.5 Zig via UDS/pipe RPC | Yes (desktop Phase 2+) |
| L2.5 Zig → L4 via C ABI | Yes (Shell process only) |
| L2 → L3 via typed RPC / local bridge | Yes (Phase 1 may skip Zig) |
| L3 → L1 (types + pure rules; native mirror) | Yes |
| L4 toolkit inside host tree | Yes |
| Bun → L4 direct FFI / dlopen toolkits | **No** |
| Page → Zig or C ABI | **No** |
| L4 → L0 | **No** (page never sees toolkit types) |
| `@vela/api` → host packages / Zig | **No** (contracts stay dep-free) |

## What is shared vs platform-private

| Concern | Shared (portable) | Platform-private |
|---------|-------------------|------------------|
| Composition model | Layer kinds, z-index truth, insert/patch | Concrete view classes |
| Input | `HitPolicy`, `WindowInputMode`, `resolveHit` | `hitTest`, message loops, gesture filters |
| Materials | `MaterialId`, `resolveMaterial`, `ResolvedMaterial` | `glassEffect`, Mica, Acrylic, gtk blur |
| Geometry | Logical `Rect` / `Region`, `scaleFactor` | Physical pixels, y-up AppKit conversion |
| Security | Permission ids, default-deny checks | OS permission prompts, code signing stores |
| Control plane | RPC envelopes, channel names | UDS path, named pipe, framing bytes; Zig owns desktop framing |
| Bun↔native glue | Zig interop + C ABI job groups | Platform `@_cdecl` / Win exports implementing those groups |
| Authoring | One dogfood / app web package; TS capability plugins | Host packaging and entitlements |
| Capability implementation | TS handlers on Bun (default) | T1.5 Zig perf kernels; T2 UI / foreign ABI |

**Semantic materials, not pixel twins.** `apple.liquidGlass` and `win.mica` both
mean “system material layer”; they are not required to look identical. See
[Materials](materials.md).

**Logical coordinates only in contracts.** The Shell converts to physical
pixels once at the platform boundary. See
[Platform support](platform-support.md) and `coordinates.ts` for AppKit helpers.

## Shell role (L3) job list

Every backend must implement these jobs. Names are conceptual; payloads use
`@vela/api` types and Phase 2 protocol modules.

| Job | Responsibility | Contract anchors |
|-----|----------------|------------------|
| **Window** | Create/show/resize/DPI/focus/close; apply `WindowInputMode` | `window/types.ts` |
| **WebView** | Embed system WebView; inject preload whitelist | `protocol/bridge.ts` |
| **Layer tree** | Insert/update/remove; z-order = draw + hit order | `layer/*` |
| **Hit router** | Exactly one `HitTarget` per pointer down; no double-delivery | `hit/*`, ADR 0001 |
| **Materials** | Resolve + paint; emit degrade diagnostics | `material/spec.ts` |
| **Native factories** | Mount signed components; enforce permissions | `component/define.ts` |
| **Control plane** | Local bridge (Phase 1) or Bun → Zig RPC (Phase 2+) | ADR 0002, ADR 0005, `protocol/rpc.ts` |

### Hard invariants (all backends)

1. Layer tree is composition truth; a WebView is one layer kind, not the sole root.
2. Shell owns hit routing; WebView and sibling natives must not both eat the same pointer event.
3. Opacity never implies hit policy.
4. Materials are real system (or explicit `fallback.css`) layers — not CSS fakes for native material kinds.
5. Capability checks are default-deny; Bun and Shell both enforce where each can see the operation.
6. Page JS is message-pass only (`call` / `layers` / `hit` / `events`).

## Backend map (L4)

| Platform | Tier | Shell language (intent) | WebView | Materials |
|----------|------|-------------------------|---------|-----------|
| macOS | 1 | Swift (AppKit + SwiftUI hosting) | WKWebView | Liquid Glass / `apple.material` |
| Windows 11 | 1 | Native at Phase 4 start (C++/WinRT or Rust+WinRT) | WebView2 | Mica / Acrylic / smoke |
| Linux | 2 | Native TBD with WebView stack | WebKitGTK or documented peer | `gtk.blur` best-effort |
| iOS | Mobile | Swift | WKWebView | System material + degrade |
| Android | Mobile | Kotlin | System WebView | `fallback.css` first |

Phase 1 executable design for macOS:
[macos-spike-architecture.md](macos-spike-architecture.md). Feature matrix and
loud-failure rules: [platform-support.md](platform-support.md).

### Why not one shared UI core?

A mandatory shared Rust (or C++) window stack tends to become “system WebView +
command bridge”. That matches Tauri’s product class, not Vela’s: we need deep
access to sibling native views, regional hit, and live-sampled materials.

ADR 0004 therefore chooses **multi-backend Shell + shared contracts**. Desktop
adds a **shared Zig interop layer** ([ADR 0005](adr/0005-zig-interop-layer.md))
for RPC and C ABI dispatch only. Optional pure ports of `resolveHit` / geometry
may live in Zig when host-mirror drift cost is proven — they must not become
the public composition API or own toolkit paint.

### Zig interop (desktop L2.5)

| Owns | Does not own |
|------|----------------|
| Bun↔Shell socket + framing | `window.vela` / page APIs |
| Method dispatch to Shell jobs | AppKit / WebView2 / GTK widgets |
| Stable C ABI to L4 | System material painting |
| Optional pure hit/geometry ports | Business plugins (Bun) |
| Shell process main (Phase 2+) | Mobile requirement (optional later) |

```text
Bun  --RPC-->  Zig interop  --C ABI-->  Swift / Win / Linux L4
```

Phase 1 macOS spike may omit Zig and use a local Swift preload bridge. Phase 2
desktop requires Zig so Windows/Linux do not each reimplement Bun wiring.

## Orchestration split (L2)

| Surface | Desktop | Mobile |
|---------|---------|--------|
| App lifecycle / packaging hooks | Bun host (Phase 2+) | Native host |
| Capability catalog + plugins | Bun host | Native host (subset) |
| Build / bundle web assets | Bun (dev + CI) | Bun on CI/dev machines only |
| In-process app JS runtime | WebView (+ Bun outside WebView) | WebView only — **no** in-process Bun app runtime |

Phase 1 may run a **single Shell process** with a thin local preload bridge so
composition can be proven before process split. See ADR 0002 D2.

## Drift control

Multi-backend only works if semantics stay locked.

| Mechanism | Role |
|-----------|------|
| `@vela/api` pure helpers + unit tests | Semantic SoT for hit, material resolve, generation, logical coords |
| Host mirrors | Native reimplementation of pure rules at the event boundary |
| Acceptance scenarios | Cross-host fitness (S1–S7, W1–W3, mobile subset) |
| Shared dogfood web package | Same L0 content; only materials/capabilities degrade |
| Platform tiers + diagnostics | Missing OS features fail loudly (`degraded`, missing WebView runtime, deny reasons) |

When a host disagrees with a pure test, fix the host. When the pure rule is
wrong for real OS behavior, change `@vela/api` and update all hosts — do not
quietly special-case one backend in app-facing types.

## Suggested host module boundaries

Keep each platform tree split by **Shell job**, not by a single growing file:

```text
hosts/
  zig-shell/                 # L2.5: RPC, dispatch, C ABI, process main
  <platform>-shell/          # L4 backend (e.g. desktop-shell Swift)
    window/                  # create, DPI, WindowInputMode
    webview/                 # embed, preload inject
    layers/                  # tree apply, z-order
    hit/                     # router; mirror resolveHit
    materials/               # resolve + paint + degrade
    factories/               # signed native components
    control/                 # Phase 1 local bridge; later C ABI surface for Zig
```

Public interfaces stay small. Platform toolkit types stay inside L4 modules.
App-facing behavior is expressed only through L1 contracts. Bun talks to Zig;
Zig talks to L4; page JS never sees either.

## Non-goals

- Pixel-identical materials across OS.
- WASM-in-browser as the primary desktop host.
- Full Chromium embed as the default Shell.
- App-visible `@vela/api-<platform>` package forks.
- Waiting for a universal UI toolkit core before shipping macOS or Windows backends.
- Zig owning AppKit/WebView2 paint (interop only; see ADR 0005).
- Bun in-process FFI into full Shell for Phase 2+ (ADR 0002).
- Merging with sibling Rust/wgpu `Vela` (different product; no WebView core).

## Related

- [ADR 0004: Cross-platform Shell abstraction](adr/0004-cross-platform-abstraction.md)
- [ADR 0005: Zig interop layer](adr/0005-zig-interop-layer.md)
- [ADR 0006: TypeScript-first capabilities](adr/0006-ts-first-capabilities.md)
- [Capabilities and plugins](capabilities-and-plugins.md)
- [Architecture](architecture.md)
- [Technology stack](technology-stack.md)
- [Platform support](platform-support.md)
- [Composition and layers](composition-and-layers.md)
- [Input and hit testing](input-and-hit-testing.md)
- [Materials](materials.md)
- [API contracts](api-contracts.md)
- [macOS spike architecture](macos-spike-architecture.md)
- [Tauri comparison](research/tauri-comparison.md)
- [Design gaps](design-gaps.md)
- [Roadmap](roadmap.md)
