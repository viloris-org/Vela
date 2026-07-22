# @vela/playground

Dogfood **web content** for the Phase 1 macOS spike. Not a complete host.

Contracts: `@vela/api` preload surface (`window.vela`). Design: [macOS spike architecture](../../docs/macos-spike-architecture.md).

## What this page does

| Piece | Behavior |
|-------|----------|
| Underlay sim | Full-client gradient (CSS). Real host paints native underlay under the WebView. |
| Floating panel + hole | Panel is interactive web UI; the large hole is **not** in opaque regions so hits pass through (`web-shaped`). |
| Toolbar | Calls `vela.layers.insert` with `kind: "material"` + capsule bounds. CSS glass is only a stand-in when the host has no material layer yet. |
| Hit regions | `vela.hit.setMainOpaqueRegions` + `setOpaqueRegions` with monotonic `generation` for panel, HUD, and toolbar chrome. |
| Debug HUD | Mock: region generation + pointer mock hit. Host: prefer `debug.hit` / last `HitTarget` if the Shell publishes it. |

## Open in a browser (layout review)

From monorepo root (after `bun install`):

```bash
bun run playground:serve
# → http://localhost:5173
```

Or:

```bash
cd apps/playground && bun run serve
```

When `window.vela` is missing, an in-page **mock** installs: logs bridge calls, draws pink/blue region overlays, and fakes a degraded material event.

## What the host injects

Phase 1 preload (Shell / WKWebView only), per spike doc:

| API | Required |
|-----|----------|
| `vela.version` | yes |
| `vela.layers.insert` / `update` / `remove` | yes (Shell-local ok) |
| `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` | yes |
| `vela.call` | optional deny-all stub |
| `vela.events.subscribe` | optional (`material.degraded`, `debug.hit`) |

Load this directory as local files, temporary `file://`, or a minimal custom scheme. Production `app://` packaging is Phase 2.

Suggested main layer id for region updates: `main-webview` (see `src/main.ts` / `MAIN_LAYER_ID`).

## Layout review checklist

1. Toolbar capsule + panel + HUD show as opaque region overlays (mock).
2. Hole area has no overlay — underlay gradient visible.
3. Resize / toggle panel re-pushes regions and bumps generation.
4. Material insert either succeeds (host) or shows CSS fallback note (mock).

## Status

Scaffold for parallel work on Linux. **Does not** complete Phase 1 (Swift Shell, real glass, real hit router still required on macOS).
