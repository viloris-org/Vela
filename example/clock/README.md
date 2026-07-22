# @vela/example-clock

Minimal **clock** App TS example. Shows how a real app talks to `window.vela` without the full playground HUD surface.

Contracts: `@vela/api` preload (`window.vela`). Spike context: [macOS spike architecture](../../docs/macos-spike-architecture.md).

## What this example does

| Piece | Behavior |
|-------|----------|
| Digital clock | Updates every 250 ms; toggle 12h / 24h |
| Clock card | Opaque web UI; reported via `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` |
| Material layer | `vela.layers.insert` with `kind: "material"` + rounded-rect bounds (CSS glass is a stand-in) |
| Hole | Space outside the card/status is **not** in opaque regions → hits fall through to underlay |
| Status strip | Generation + bridge log (mock draws region overlays in the browser) |

## Open in a browser (layout review)

From monorepo root (after `bun install`):

```bash
bun run example:clock
# → http://localhost:5174
```

Or:

```bash
cd example/clock && bun run serve
```

When `window.vela` is missing, an in-page **mock** installs: logs bridge calls and draws blue region overlays.

## What the host injects

Same Phase 1 preload surface as the playground:

| API | Required |
|-----|----------|
| `vela.version` | yes |
| `vela.layers.insert` / `update` / `remove` | yes (Shell-local ok) |
| `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` | yes |
| `vela.call` | optional deny-all stub |
| `vela.events.subscribe` | optional (`material.degraded`) |

Suggested main layer id for region updates: `main-webview` (see `src/main.ts` / `MAIN_LAYER_ID`).

## Layout review checklist

1. Clock card + status strip show as opaque region overlays (mock).
2. Space around the card has no overlay — underlay gradient visible.
3. Resize re-pushes regions and bumps generation.
4. Material insert either succeeds (host) or keeps the CSS glass stand-in (mock).

## Status

Example app for App TS authors. **Does not** implement a host. Pair with `apps/playground` for the composition dogfood surface and `hosts/desktop-shell` for a real Shell.
