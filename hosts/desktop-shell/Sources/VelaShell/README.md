# Sources/VelaShell

Placeholder for Phase 1 Swift sources (macOS only).

Expected modules (names illustrative; implement against `@vela/api` contracts):

| Area | Responsibility |
|------|----------------|
| App / window bootstrap | `NSWindow`, content view = `VelaHitRootView` |
| Hit root | Sole `hitTest` policy; `resolveHit` mirror |
| Layer map | `LayerId` → `NSView` / hosting view |
| WKWebView | Main web layer; inject preload for `window.vela` |
| Material host | Capsule toolbar; Liquid Glass or degraded material |
| Region store | `opaqueRegions` + generation for `web-shaped` |

Add real `.swift` files only when building on a Mac with Xcode. Prefer not to commit non-compiling code.

Dogfood HTML: `apps/playground` (see `../../DogfoodContent/README.md`).
