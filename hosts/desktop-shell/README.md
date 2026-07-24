# hosts/desktop-shell

**Phase 1 macOS composition Shell MVP** — native process (Swift / AppKit + WKWebView).

> **Status**: MVP sources landed (window + WKWebView + preload + layer/hit store + material host degrade). Full S1–S7 hit ownership still open.  
> **Machine note**: build and run require **macOS + Xcode / Swift 5.9+**. This monorepo is often edited on Linux.  
> **Portable policy**: layer/hit semantics mirror `@vela/shell-core` / `@vela/api`; this tree paints and delivers events.

Product contracts: `@vela/api`. Design: [docs/macos-spike-architecture.md](../../docs/macos-spike-architecture.md). Cross-host role: [docs/cross-platform-abstraction.md](../../docs/cross-platform-abstraction.md) / [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md).

## Goals (MVP)

1. Open a native window and load dogfood content via `--url`.
2. Inject `window.vela` subset (`version`, `layers`, `hit`, `call` deny-all, `events`).
3. Sibling underlay + WKWebView + optional material host under a flipped content root.
4. Store web-shaped regions + generation; log `resolveHit` on pointer-down.
5. Material insert uses `NSVisualEffectView` and emits **`material.degraded`** (`mvp-visual-effect-only`).

Non-goals (this MVP): sole `hitTest` dual-delivery proof, Liquid Glass sampling, Bun/Zig process split, Windows host (see `hosts/windows-shell`).

## Build & run (macOS)

```bash
cd hosts/desktop-shell
swift build -c release --product vela-desktop-shell

# Terminal A
bun run example:clock          # http://127.0.0.1:5174

# Terminal B
.build/release/vela-desktop-shell --url http://127.0.0.1:5174
```

Or via CLI (on macOS, once binary exists):

```bash
bun run vela -- dev --platform macos --dir example/clock
```

### CLI flags

| Flag | Meaning |
|------|---------|
| `--url URL` | Main WebView URL (default `http://127.0.0.1:5174`) |
| `--version` | Print version |
| `--help` | Usage |

Binary path used by `vela dev`: `hosts/desktop-shell/.build/release/vela-desktop-shell`.

## View tree (AppKit)

```text
NSWindow
└── contentView = HitRootView (isFlipped = true; logical top-left)
    ├── UnderlayNativeView      z ~5
    ├── MaterialHostView        (hidden until layers.insert material)
    ├── MainWKWebView           z ~10
    └── debug hit label
```

Coordinate space at the bridge: **logical content**, origin top-left, y down.

## Preload contract

`Sources/VelaShell/Resources/preload.js` — keep in sync with `hosts/linux-shell/scripts/preload.js`.

| Surface | Behavior |
|---------|----------|
| `version` | `0.0.1-macos-shell` (not `*-mock`) |
| `layers.*` | Message-pass → host layer tree + material host |
| `hit.*` | Opaque region store + generation drop |
| `call` | Deny-all |
| `events.subscribe` | Page-side; host may emit `material.degraded` |

## Implementation checklist

- [x] Portable Shell policy in `@vela/shell-core` (TS; Linux-testable)
- [x] Swift package / executable `vela-desktop-shell`
- [x] NSWindow + sibling underlay + WKWebView
- [x] Preload inject `window.vela` + JSON bridge
- [x] Layer tree + web-shaped store (generation drop)
- [x] Material host + loud degrade path
- [x] Pointer-down `resolveHit` debug label (coarse; not sole hitTest yet)
- [ ] `VelaHitRootView` sole hit policy (no dual delivery) — S6
- [ ] Liquid Glass / true system material path — S1
- [ ] Manual acceptance S1–S7
- [ ] Wire full dogfood toolbar bootstrap on host if app does not insert

## Module map

| Swift area | Responsibility |
|------------|----------------|
| `main.swift` | CLI + `NSApplication` |
| `App/ShellController.swift` | Window, views, lifecycle |
| `Hit/*` | Root view + `ResolveHit` mirror |
| `Layers/LayerTree.swift` | Layer + shape store |
| `WebView/MainWebViewFactory.swift` | WKWebView + user script |
| `Bridge/MessageHandler.swift` | JSON req/hit handlers |
| `Materials/MaterialHostView.swift` | Degraded visual effect |
| `Resources/preload.js` | `window.vela` inject |

## Dogfood layer ids

| Id | Role |
|----|------|
| `underlay-native` | Native underlay |
| `main-webview` | Primary WKWebView (web-shaped) |
| `toolbar-material` | Material toolbar (app insert) |

## Process shape

| Mode | Shape |
|------|--------|
| Spike / MVP | Single native process + thin local preload |
| Phase 2 | Bun + Zig UDS + C ABI ([ADR 0002](../../docs/adr/0002-ipc-privilege.md), [ADR 0005](../../docs/adr/0005-zig-interop-layer.md)) |

## Exit criteria (Phase 1 full)

Not complete until [testing-and-acceptance](../../docs/testing-and-acceptance.md) **S1–S7** pass. This MVP only unlocks window + WebView dogfood on macOS.

## References

- [macos-spike-architecture.md](../../docs/macos-spike-architecture.md)
- [linux-shell](../linux-shell) — reference L4 + preload protocol
- [windows-shell](../windows-shell) — Windows scaffold (C++/WinRT + WebView2)
- [packages/shell-core](../../packages/shell-core)
