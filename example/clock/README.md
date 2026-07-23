# @vela/example-clock

Minimal **clock** App TS sample for the **Linux host** dogfood path: real `window.vela` preload, material insert, web-shaped hit regions.

Contracts: `@vela/api` preload (`window.vela`). Host: `hosts/linux-shell` ([linux spike](../../docs/linux-spike-architecture.md)).

## Host path (primary)

Requires GTK4 + WebKitGTK 6.0 + Zig 0.16.x (see `hosts/linux-shell/README.md`).

```bash
# terminal 1 — bundle + serve App TS for WebView
cd /path/to/Vela
bun install
bun run example:clock
# → http://127.0.0.1:5174  (main.js is Bun-built browser JS)

# terminal 2 — native Shell
cd hosts/linux-shell
zig build
zig build run -- --url http://127.0.0.1:5174
# default URL is already :5174 if you omit --url
```

Expected:

| Check | Pass |
|-------|------|
| Mode pill | `host 0.0.1-linux-shell` (not `mock`) |
| Clock | Time ticks; 12h/24h toggle works |
| Material | Native glass widget under card (often degraded translucent chrome + `material.degraded` log) |
| Hit | Card/status clickable; empty space → underlay (`lastHit` debug label) |
| Regions | Status generation bumps on resize / “Push regions” |

## What the host injects

| API | Required |
|-----|----------|
| `vela.version` | yes |
| `vela.layers.insert` / `update` / `remove` | yes |
| `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` | yes |
| `vela.call` | deny-all stub |
| `vela.events.subscribe` | `material.degraded` |

Main web layer id: `main-webview`. Clock material id: `clock-material` (zIndex **8**, under web z **10**, `hitPolicy: transparent` — glass backdrop, web owns UI hits).

## Layout / composition model

```text
underlay-native (z 5)
  └── clock-material glass (z 8, under WebView)
        └── main-webview (z 10, web-shaped: card + status opaque)
```

Outside card/status is a **hole** → Shell routes to underlay. CSS `#underlay-sim` is hidden when host preload is present.

## Serve only (content package)

```bash
bun run example:clock
# or: cd example/clock && bun run serve
```

`serve.ts` **bundles** `src/main.ts` → `/main.js` for WebKitGTK. Raw TypeScript is not loadable in the host WebView.

If `window.vela` is missing (plain browser), an in-page mock still installs for layout review — that is **not** the host dogfood path.

## Status

- [x] Bundle + serve for host WebView
- [x] Host-aware UI (hide underlay sim, softer CSS glass)
- [x] linux-shell: minimal bootstrap, material under web, full bounds, degrade event
- [ ] Compositor blur applied to material host (still honest degrade)
- [ ] macOS Swift host parity
