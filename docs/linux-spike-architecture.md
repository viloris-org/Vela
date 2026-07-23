# Linux composition spike architecture

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Linux Tier 2 executable design; product contracts remain `@vela/api` + ADRs

Executable design for a **Linux composition spike** (Tier 2): prove multi-kind layers, regional hit-through, single event delivery, and honest material degrade on **GTK4 + WebKitGTK 6.0**, without waiting for macOS Phase 1 Swift hardware.

Status: design + host tree under `hosts/linux-shell`. Contracts: `@vela/api`. Decisions: [ADR 0001](adr/0001-composition-hit-material.md), [ADR 0004](adr/0004-cross-platform-abstraction.md). Baseline lock: [G-P2-3](design-gaps.md). Acceptance: [Testing and acceptance](testing-and-acceptance.md) **L1–L6**. macOS parallel: [macOS spike architecture](macos-spike-architecture.md).

## Goals / non-goals

### Goals

1. One window with multi-kind layers: underlay + `webview` + `material`.
2. Shell-owned hit router: **one** `HitTarget` per pointer down.
3. `web-shaped` holes from Web → Shell via `vela.hit`.
4. Material toolbar with preferred id `gtk.blur` (or mapped request) and **loud** degrade when live sample blur is unavailable.
5. Preload inject subset of `window.vela` (`version`, `layers`, `hit`; `call`/`events` stub ok).
6. Same dogfood content package as macOS: `apps/playground`.

### Non-goals (spike)

- Bun host process split / Zig UDS (Phase 2; optional later attach).
- Full capability engine / plugin ABI.
- Pixel-identical glass vs Liquid Glass / Mica.
- Window → OS region-through as a hard exit gate (Tier 2 partial).
- Dual-maintaining GTK3 / WebKit2GTK 4.1.
- macOS Swift sources.

## Locked stack baseline (G-P2-3)

| Piece | Choice |
|-------|--------|
| Toolkit | **GTK 4** |
| WebView | **WebKitGTK 6.0** (`pkg-config webkitgtk-6.0`) |
| Material id | **`gtk.blur`** (best-effort; compositor-dependent) |
| Process | Single native Shell process + thin local preload bridge |
| Language | **Zig** process + thin **C** GObject wrappers (policy in Zig) |
| Host folder | `hosts/linux-shell` (not `hosts/desktop-shell`) |

Older distro peer (WebKit2GTK 4.1 / GTK3) is **not** a v1 dual-maintain target. Document only if a later port is required.

## Recommended process shape

| Mode | Shape | When |
|------|--------|------|
| **Spike default** | Single process: GTK app implements Shell + in-process preload | Prove hit + materials |
| Phase 2 | Bun → Zig UDS → C ABI → this L4 as real backend | [ADR 0002](adr/0002-ipc-privilege.md), [ADR 0005](adr/0005-zig-interop-layer.md) |

Phase 1-style spike may omit Zig interop RPC. Production desktop still expects Zig on the Bun↔Shell path later.

## View tree (GTK4)

All composition surfaces are **siblings** under a single hit-policy root.

```text
GtkWindow
└── content = VelaHitRoot (overlay / custom host)
    ├── UnderlayWidget              zIndex 5    (color / drawing area)
    ├── WebKitWebView               zIndex 10   (primary web, web-shaped)
    ├── MaterialHostWidget          zIndex 30   (blur attempt or translucent degrade)
    └── optional ChromeHitWidgets   zIndex 40
```

### Hard rules

| Rule | Reason |
|------|--------|
| Hit root is the **only** policy owner | Single delivery; layer tree is truth |
| WebView is a **sibling** of material/native | Parent widgets that always claim events starve WebView or underlay |
| Draw order and hit order follow Shell `zIndex` | ADR 0001 D1 |
| Opacity never implies hit policy | Acceptance L5 / Qt-class #6 |
| Logical content coords: origin top-left, y down | Convert once at GDK boundary |

## Hit router ownership

```text
  GdkEvent / controllers ──▶ VelaHitRoot policy
                                │ uses layer tree + opaque region store
                                ▼
                          resolveHit(...)  // mirror packages/api
                                │
                                ▼
                           HitTarget
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         WebKitWebView    MaterialHost      Underlay / chrome
```

Algorithm must match pure `resolveHit` in `@vela/api` (`packages/api/src/hit/resolve-hit.ts`). When native and pure tests disagree, fix the host first unless the pure rule is wrong for all platforms.

### web-shaped state

Same as macOS spike:

| Field | Role |
|-------|------|
| `layerId` | Target webview layer (dogfood: `main-webview`) |
| `opaqueRegions` | Union of primitives that capture hits |
| `generation` | Monotonic; drop stale updates |

Default for new webview layers: `hitPolicy: web-shaped` with **empty** regions until the page reports UI.

## Materials (`gtk.blur`)

Linux has no portable API for “live-sample sibling layers below this rect” comparable to Liquid Glass.

| Path | When | Contract result |
|------|------|-----------------|
| Snapshot / GSK blur of lower layers | Host implements | `effective: gtk.blur`; prefer `degraded: true` with reason `snapshot-blur` if not live compositor glass |
| Compositor window-behind blur | Applicable and samples policy allows | `gtk.blur` + reason `compositor-window-blur` |
| Translucent solid / non-sampling fill | Default spike | `degraded: true`, reason `no-backdrop-blur` (or `compositor-unavailable`) |
| CSS `backdrop-filter` | Only as **`fallback.css`** | Do not claim native `gtk.blur` without diagnostics |

Never silent-success a flat semi-transparent box as full system material without a degrade reason.

Pure `resolveMaterial("gtk.blur", "linux")` returns preferred id with `degraded: false` meaning **policy preference**, not a paint guarantee. Shell paint sets real diagnostics.

## Preload (spike subset)

Inject into the main WebKitWebView only:

| API | Spike |
|-----|--------|
| `vela.version` | required |
| `vela.layers.insert/update/remove` | required (Shell-local) |
| `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` | required |
| `vela.call` | deny-all structured error |
| `vela.events.subscribe` | optional; recommend `material.degraded` + `debug.hit` |

Message-pass only — no Node, no FFI from page JS.

## Dogfood

| Id | Role | zIndex |
|----|------|--------|
| `underlay-native` | Native underlay | 5 |
| `main-webview` | Primary WebView | 10 |
| `toolbar-material` | Capsule material toolbar | 30 |

Content: `apps/playground`. Prefer loading via `bun run playground:serve` (`http://127.0.0.1:5173`) for module scripts; `file://` is optional later.

## Exit criteria (L1–L6)

| Gate | Pass when |
|------|-----------|
| L1 | Window + WebView loads playground; no silent blank |
| L2 | Material host present; hits toolbar; degrade reason if no real blur |
| L3 | Web-shaped hole → underlay (not OS desktop) |
| L4 | One `HitTarget` per pointer down (debug HUD / log) |
| L5 | Opacity change does not silently change hit policy |
| L6 | Stale `generation` web-shape updates dropped |

Stretch (document, do not block): OS region-through, chrome drag, camera slot, Zig C ABI vtable link.

## Implementation checklist

- [x] G-P2-3 baseline locked (GTK4 + WebKitGTK 6.0, `gtk.blur` best-effort)
- [x] This architecture doc
- [x] `hosts/linux-shell` Zig build + thin C GTK wrappers
- [x] Window + WebView navigate URL (default playground serve)
- [x] Preload `window.vela` subset (embedded)
- [x] Layer tree + dogfood bootstrap ids
- [x] Hit router mirror of `resolveHit` + lastHit (`--self-test` + UI label)
- [x] Material host + degrade diagnostics
- [ ] Manual L1–L6 on Fedora-class Wayland/X11

## Platform pitfalls (Linux)

| Risk | Mitigation |
|------|------------|
| WebKit internal event handling vs overlays | Sole hit root; pick/controller policy before dual delivery |
| No live layers-below glass | Explicit degrade + diagnostics |
| Wayland vs X11 input regions | Tier 2 partial for window-through; document session used |
| `file://` ES modules | Prefer localhost dogfood serve for first demo |
| Zig `@cImport` of full GTK | Thin C surface; keep Zig modules by Shell job |

## References

- [macOS spike architecture](macos-spike-architecture.md)
- [Cross-platform abstraction](cross-platform-abstraction.md)
- [Platform support](platform-support.md)
- [Materials](materials.md)
- [Testing and acceptance](testing-and-acceptance.md)
- [ADR 0001](adr/0001-composition-hit-material.md)
- [ADR 0004](adr/0004-cross-platform-abstraction.md)
- [ADR 0005](adr/0005-zig-interop-layer.md)
- `packages/api` — `resolveHit`, `resolveMaterial`, `VelaPreloadBridge`
- `packages/shell-core` — dogfood ids and portable policy tests
