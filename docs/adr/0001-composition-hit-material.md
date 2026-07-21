# ADR 0001: Composition Tree, Hit Testing, and Material Layers

- **Status**: Accepted
- **Date**: 2026-07-21
- **Deciders**: Project maintainers

## Context

Vela is a Bun-centered GUI framework targeting desktop and mobile, with:

- **WebView-first** main UI
- **Strong shell control** (window, chrome, protocol, permissions)
- **Qt-class composition**: multi-layer stacking, **regional** (not whole-window-only) hit-through
- **Native overlays**, including platform materials such as Apple **Liquid Glass** via Swift/system APIs
- **Large surface area of system capabilities** behind a unified Capability model

Flutter desktop often exposes whole-window mouse ignore / click-through. Electron is Chromium-heavy and weak at true native sibling composition. Qt provides widget stacking, masks, and partial event transparency. We want Qt-like composition philosophy with Web productivity and Bun as the desktop host language.

## Decisions

### D1 — Layer tree is the composition truth

Each window owns a **Layer tree**. A WebView is **one layer kind**, not the sole content root.

Canonical stack (example):

```
Window
└── RootLayer
    ├── underlay-native   (map / GPU / video)
    ├── web-main          (primary WebView)
    ├── native-slot       (camera, terminal, …)
    ├── material-glass    (Liquid Glass / Mica / …)
    ├── native-controls   (optional children of material)
    ├── web-overlay       (optional isolated WebView)
    └── chrome            (drag regions, system button hits)
```

**Draw order** and **default hit order** both follow `zIndex` (higher first for hit-test).

### D2 — Two-level input model

| Level | Type | Purpose |
|-------|------|---------|
| Window → OS | `WindowInputMode` | Click-through to *other applications* / desktop |
| Layer ↔ Layer | `HitPolicy` | Partial pass-through among layers *inside* the app |

These must not be conflated. Annotator-style “hole to desktop” uses `WindowInputMode`. “Web UI with hole to map underlay” uses `HitPolicy`.

### D3 — HitPolicy modes (v1)

Supported in v1:

- `opaque` — full bounds receive hits
- `transparent` — layer ignored for hit-test
- `mask` — only `Region` (rect unions / rounded rects) receives hits
- `web-shaped` — Web layer reports opaque regions (or point queries); rest passes through

Deferred:

- per-pixel `alpha` threshold (expensive)
- arbitrary CSS transform–driven native hitching

**v1 placement constraints**: native/material slots are axis-aligned; no list-cell-per-row native embedding; scroll-linked slots are Phase 2.

Shell **must** own hit routing and **must not double-deliver** events to WebView and overlay native views (known WKWebView + NSView pitfalls).

### D4 — Material layers are first-class

System materials (Apple Liquid Glass, Windows Mica/Acrylic, etc.) are `kind: "material"`, not ad-hoc hacks.

- **True** Liquid Glass / system materials are rendered by **platform native** code (SwiftUI `.glassEffect`, AppKit/UIKit hosting, Win composition APIs).
- They must **sample real surfaces below** in the same window compositor. CSS `backdrop-filter` is only `fallback.css`.
- `BackdropSource` is explicit: `layers-below` | specific layer | window content.
- Cross-platform API is **semantic** (“system material”), not pixel-identical.

HIG note (Apple): prefer materials on the **functional** layer (chrome, toolbars, transient controls), not dense document content.

### D5 — Native components and plugins

- UI-bearing system features register as **Native Components** → create Layers.
- Non-UI features are **Capabilities** only (fs, notify, keyring, …).
- Apps/plugins may ship **signed** native factories (e.g. extra Swift views) loaded by the Shell; Bun never `dlopen`s arbitrary code from page JS.
- Preload exposes a **whitelist bridge** only (`call`, `layers`, `events`) — no Node integration, no raw FFI from the Web.

### D6 — Runtime split

| Role | Desktop | Mobile |
|------|---------|--------|
| Orchestration / capabilities / plugins | **Bun host** | Shared TS contract; host is Swift/Kotlin |
| Windowing, WebView, layers, hit router | **Native Shell** | Same |
| Liquid Glass / platform materials | Apple backend (Swift) | UIKit/SwiftUI host |
| Main UI | WebView | WebView (v1) |

Bun is **not** the in-process JS engine on iOS/Android for the full app runtime. Mobile runs a native host + shared Capability/Layer protocol; bundles are produced with Bun on CI/dev machines.

### D7 — Security defaults

- Capabilities default **deny**; granted via app manifest.
- Creating a sensitive native layer (e.g. camera) requires matching permissions.
- Loading unsigned native modules is off by default.
- Custom URL schemes (`app://`, `asset://`) in production; no open localhost by default.

## Consequences

### Positive

- Qt-like partial hit-through and multi-native stacking
- Real system materials (Liquid Glass) without faking in CSS
- Clear extension point for more system APIs
- Same TS contracts for desktop and mobile hosts

### Negative / costs

- Shell complexity (hit router, multi-backend)
- v1 limits on scroll/transform-synced natives
- Platform visual divergence for materials (accepted)
- Need platform engineers for Apple/Win/Linux backends

### Follow-ups

- ADR 0002: IPC / typed RPC and privilege boundaries
- ADR 0003: Plugin ABI and signing
- Spike: macOS demo — WebView + Liquid Glass toolbar + hole hit-test

## References

- Project design threads: WebView-first, strong control, local native, composition/hit, Liquid Glass
- Apple: Adopting Liquid Glass; Applying Liquid Glass to custom views (SwiftUI `glassEffect`, `GlassEffectContainer`)
- Qt (public Qt 6 docs; local tree may be `../qt6` with empty submodules until `init-repository`):
  - `QWidget::setMask` / `QWindow::setMask`
  - `Qt::WA_TransparentForMouseEvents`, `Qt::WA_NoMousePropagation`
  - `Qt::WindowTransparentForInput` (top-level → OS; distinct from child hit policy)
  - `QQuickItem::z`, `contains`, `containmentMask`
  - `QWidget::createWindowContainer` (foreign / Quick-in-Widgets surfaces)
- Expanded mapping: [Qt composition notes](../qt-composition-notes.md)
- Shell security / IPC vocabulary (reference only): [Tauri comparison](../tauri-comparison.md),
  Tauri 2 [process model](https://v2.tauri.app/concept/process-model/),
  [IPC](https://v2.tauri.app/concept/inter-process-communication/),
  [capabilities](https://v2.tauri.app/security/capabilities/)
- Acceptance checklists: [Testing and acceptance](../testing-and-acceptance.md)
- Contrast: Flutter desktop whole-window ignore-mouse patterns
