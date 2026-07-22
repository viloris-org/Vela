# Sources/VelaShell

Placeholder for Phase 1 Swift sources (macOS only).

Portable policy reference: **`@vela/shell-core`** (`packages/shell-core`). Do not reimplement hit algorithms — mirror pure `resolveHit` / shell-core behavior at the AppKit boundary.

## Module map (Swift ↔ TS)

| Swift area | Responsibility | TS counterpart |
|------------|----------------|----------------|
| App / window bootstrap | `NSWindow`, content view = `VelaHitRootView` | `createShellCore` + window options |
| Hit root | Sole `hitTest` policy | `ShellCore.resolvePointer` / `pointerDown` → `@vela/api` `resolveHit` |
| Layer map | `LayerId` → `NSView` / hosting view | `layer-tree` insert/update/remove |
| WKWebView | Main web layer; inject preload for `window.vela` | `createPreloadBridge` / `VelaPreloadBridge` |
| Material host | Capsule toolbar; Liquid Glass or degraded material | `resolveToolbarMaterial` + `resolveMaterial` |
| Region store | `opaqueRegions` + generation for `web-shaped` | `web-shape-store` / `applyWebShapeUpdate` |
| Dogfood bootstrap | underlay + main web + glass toolbar | `applyDogfoodBootstrap`, `DOGFOOD_LAYER_IDS` |

## Dogfood layer ids

| Id | Kind | zIndex |
|----|------|--------|
| `underlay-native` | native underlay | 5 |
| `main-webview` | webview (web-shaped) | 10 |
| `toolbar-material` | material toolbar | 30 |

Add real `.swift` files only when building on a Mac with Xcode. Prefer not to commit non-compiling code.

Dogfood HTML: `apps/playground` (see `../../DogfoodContent/README.md`).
