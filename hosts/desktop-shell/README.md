# hosts/desktop-shell

**Phase 1 macOS spike** — native Shell process (Swift / AppKit + WKWebView).

> **Status**: scaffold only. No compilable Swift app is checked in yet.  
> **Machine note**: this monorepo is often edited on Linux; Xcode and macOS are required to build and run the Shell.  
> **Portable policy**: layer/hit state machine lives in `@vela/shell-core` (`packages/shell-core`) with S-class tests — mirror that behavior in AppKit, do not re-derive hit rules.

Product contracts: `@vela/api`. Executable design: [docs/macos-spike-architecture.md](../../docs/macos-spike-architecture.md). Cross-host Shell role: [docs/cross-platform-abstraction.md](../../docs/cross-platform-abstraction.md) / [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md). Phase 2 Bun path: Zig interop ([ADR 0005](../../docs/adr/0005-zig-interop-layer.md)); this tree is the macOS **L4** backend.

## Goals (Phase 1)

Prove Qt-class composition on macOS:

1. Multi-kind layers: underlay + webview + material (+ optional chrome).
2. Shell-owned hit router: **one** `HitTarget` per pointer down.
3. `web-shaped` holes via `vela.hit` from dogfood content.
4. True system material toolbar (`apple.liquidGlass` or degraded `apple.material`).
5. Preload injects subset of `window.vela` (`version`, `layers`, `hit`; `call`/`events` stub ok).

Non-goals: Bun host process split, full capability engine, Windows/Linux hosts, CSS faking of Liquid Glass for the material layer.

## View tree (AppKit)

From the spike architecture — **siblings** under a single hit root:

```text
NSWindow
└── contentView = VelaHitRootView ← sole hitTest override
    ├── UnderlayNativeView                 zIndex 0..9   (map / video / color stub)
    ├── MainWKWebView                      zIndex 10     (primary web)
    ├── NativeSlotView?                    zIndex 20     (optional camera stub)
    ├── MaterialHostView                   zIndex 30     (NSHostingView + glass)
    └── ChromeHitViews                     zIndex 40     (drag-region / system-buttons)
```

Hard rules:

- Only `VelaHitRootView` owns policy `hitTest`.
- WKWebView is a **sibling** of material/native, not a child of a canvas that returns `self`.
- Opacity never implies hit policy.
- Coordinate space at the bridge: logical content, origin top-left, y down (convert from AppKit once).

## Dogfood content

Web content lives in **`apps/playground`** (`@vela/playground`).

| Approach | Notes |
|----------|--------|
| Load path | Point WKWebView at `apps/playground/index.html` (repo-relative or copy into app bundle later). |
| Symlink (optional) | `DogfoodContent` → `../../apps/playground` for Xcode resource groups. |
| Browser | `bun run playground:serve` for layout-only review with mock `window.vela`. |

Do not invent APIs beyond `VelaPreloadBridge` in `@vela/api`.

## Implementation checklist

Copy of spike doc — track progress here as work lands:

- [x] Portable Shell policy in `@vela/shell-core` (TS; Linux-testable)
- [ ] Xcode macOS target; Swift package / app under this tree
- [ ] `VelaHitRootView` + layer → NSView map
- [ ] WKWebView creation, navigation, preload script injection (`window.vela`)
- [ ] Material host (`glassEffect` / `GlassEffectContainer` or `NSVisualEffectView` + `degraded`)
- [ ] web-shaped region store + generation (drop stale updates; same rules as shell-core)
- [ ] Keep pure `resolveHit` tests in `@vela/api` as the algorithm SoT; mirror in Swift
- [ ] Manual acceptance S1–S6 ([testing-and-acceptance.md](../../docs/testing-and-acceptance.md)); S7 if generation used
- [ ] Wire dogfood: underlay + main web + capsule toolbar; verify single delivery

## Swift ↔ `@vela/shell-core` interface map

When adding real Swift sources, mirror modules by responsibility (not one giant file):

| Swift area (illustrative) | `@vela/shell-core` / `@vela/api` |
|---------------------------|----------------------------------|
| Layer tree apply | `ShellCore.insertLayer` / `updateLayer` / `removeLayer` / `listLayers` |
| Opaque region store | `setOpaqueRegions` / `setMainOpaqueRegions` → `applyWebShapeUpdate` |
| `VelaHitRootView.hitTest` | `resolvePointer` / `pointerDown` → pure `resolveHit` |
| Last hit HUD | `lastHit` + `debug.hit` event |
| Preload `window.vela` | `createPreloadBridge` shape (`VelaPreloadBridge`) |
| Bootstrap dogfood stack | `applyDogfoodBootstrap` / `DOGFOOD_LAYER_IDS` |
| Material resolve | `resolveToolbarMaterial` → `resolveMaterial` |

Dogfood layer ids (must match playground):

| Id | Role |
|----|------|
| `underlay-native` | Native underlay (z 5) |
| `main-webview` | Primary WKWebView (z 10, web-shaped) |
| `toolbar-material` | Capsule material toolbar (z 30) |

## Folder layout (scaffold)

```text
hosts/desktop-shell/
  README.md                 ← this file
  Package.swift             ← stub comment only (not a buildable package yet)
  Sources/
    VelaShell/
      README.md             ← placeholder for future Swift sources
  DogfoodContent/
    README.md               ← how to attach apps/playground
```

**Do not** add fake Swift that cannot compile on CI/Linux. Real sources land when building on macOS with Xcode.

## Process shape

| Mode | Shape |
|------|--------|
| Spike default | Single native process: Shell + thin local preload bridge |
| Phase 2 | Bun orchestration + Shell process, Unix socket RPC ([ADR 0002](../../docs/adr/0002-ipc-privilege.md)) |

## Exit criteria

Phase 1 is **not** complete until the spike architecture exit criteria are met (demo/video S1–S6, no dual delivery, real or explicitly degraded material, `InsertLayerSpec`-shaped ops). This folder alone does not claim that.

## References

- [macos-spike-architecture.md](../../docs/macos-spike-architecture.md)
- [ADR 0001](../../docs/adr/0001-composition-hit-material.md)
- [packages/api](../../packages/api) — `VelaPreloadBridge`, layers, hit
- Apple: Applying Liquid Glass to custom views; `NSView.hitTest(_:)`
