# @vela/shell-core

Portable **in-process Shell policy** for Phase 1: layer tree, web-shaped region store, hit routing, dogfood bootstrap, and a `VelaPreloadBridge` adapter.

> **Status**: TypeScript state machine only. No windowing, WKWebView, or system material paint.  
> **Contracts**: `@vela/api` pure helpers remain the algorithm SoT (`resolveHit`, `applyWebShapeUpdate`, `resolveMaterial`).

## Role

| This package | Host L4 (Swift / Win / …) |
|--------------|---------------------------|
| Mutable layer tree + insert/update/remove | Map layers to NSView / HWND siblings |
| Opaque region store + generation drop | Same rules at event boundary |
| `resolvePointer` / `pointerDown` + `lastHit` | `VelaHitRootView.hitTest` mirrors `resolveHit` |
| `createPreloadBridge` | Inject into WebView as `window.vela` |
| Dogfood bootstrap specs | Create real underlay / web / glass views |

## Public surface

```ts
import {
  createShellCore,
  createPreloadBridge,
  applyDogfoodBootstrap,
  DOGFOOD_LAYER_IDS,
} from "@vela/shell-core";

const core = createShellCore({ platform: "macos", supportsLiquidGlass: false });
applyDogfoodBootstrap(core, { x: 0, y: 0, width: 800, height: 600 });
const vela = createPreloadBridge(core);
```

## Dogfood layer ids

Must match playground string literals:

| Constant | Id | Kind |
|----------|-----|------|
| `DOGFOOD_LAYER_IDS.underlay` | `underlay-native` | native underlay |
| `DOGFOOD_LAYER_IDS.mainWebview` | `main-webview` | web-shaped webview |
| `DOGFOOD_LAYER_IDS.toolbarMaterial` | `toolbar-material` | material toolbar |

Playground **does not** depend on this package (web content stays host-free). Tests pin the literals.

## Non-goals

- Real AppKit / WebView2 / GTK paint
- Bun process split / Zig RPC (Phase 2)
- Full capability engine
- Claiming S1–S7 host acceptance without a native Shell

## Swift interface map

See `hosts/desktop-shell/Sources/VelaShell/README.md` for how L4 modules should mirror this package.

## Tests

```bash
bun test packages/shell-core
```

S-class coverage: S2 hole→underlay, S6 single `lastHit`, S7 stale generation, opacity≠hit, material resolve degrade, window region-through lite, bridge deny-all `call`.
