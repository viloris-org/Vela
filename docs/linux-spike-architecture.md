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

Pure `resolveMaterial("gtk.blur", "linux")` returns preferred id with `degraded: false` meaning **policy preference**, not a paint guarantee. Shell paint sets real diagnostics via `planMaterialPaint` + session probe (see below).

## Wayland session capabilities (abstraction)

Wayland protocol objects are **L4-private**. They are mapped into portable
`ShellSessionFeature` ids in `@vela/api` (`session/features.ts`). Page JS never
sees interface names like `ext_background_effect_manager_v1`.

### Probe flow

```text
GdkDisplay
  ├─ backend: wayland | x11 | unknown
  └─ (Wayland) gdk_wayland_display_query_registry(global)
         │
         ▼
  session.zig featuresForWaylandGlobal(name)
         │
         ▼
  ShellSessionProbe { displayBackend, features[] }
         │
         ▼
  planMaterialPaint / planGtkBlurPaint → MaterialPaintPath + degrade reason
```

Host surface: `hosts/linux-shell/src/c/vela_session.c` + `src/session.zig`.

### Wayland global → portable feature map (initial)

| Wayland global (L4) | Portable feature | Shell job |
|---------------------|------------------|-----------|
| `ext_background_effect_manager_v1` | `material.backdrop.window-behind` | Materials paint path |
| `org_kde_kwin_blur_manager` | `material.backdrop.window-behind` | Materials (Plasma legacy) |
| `wl_compositor` (input region) | `window.input-region` | `WindowInputMode` region-through |
| `wp_fractional_scale_manager_v1` | `window.fractional-scale` | DPI / scaleFactor |
| `wp_alpha_modifier_v1` | `window.alpha` | Translucent toplevel |
| `zxdg_decoration_manager_v1` | `window.server-decoration` | Window chrome |
| `zwp_idle_inhibit_manager_v1` | `session.idle-inhibit` | Keep-awake capability later |
| `xdg_activation_v1` | `session.activation` | Focus / launch activation |

Add rows here when binding new protocols. Prefer **semantic** feature ids over
exporting protocol strings into `@vela/api`.

### Critical semantic split: window-behind vs layers-below

Full cross-platform mapping (buckets A–E, Mica/Acrylic/Liquid Glass, resolve + paint plan): **[materials.md](materials.md)**.

| Request | Meaning | Typical Linux path |
|---------|---------|-------------------|
| `samples: { type: "layers-below" }` | Blur **sibling layers** under the material rect (Liquid Glass class, bucket **C**) | Snapshot / GSK; **not** what `ext-background-effect` does alone |
| `samples: { type: "window-content" }` | Desktop atmosphere / see-desktop (buckets **A/B**) | Compositor window-behind when available |
| Compositor **window-behind** blur | Blur **desktop / other clients** behind this surface | `ext-background-effect-v1` `set_blur_region`, KDE blur |

On Linux, buckets **A** (Mica-class cheap atmosphere) and **B** (Acrylic-class live blur) usually **collapse** to one compositor feature — there is no separate low-cost wallpaper-only API. That is a platform limit, not a Vela omission.

`ext-background-effect-v1` ([protocol](https://wayland.app/protocols/ext-background-effect-v1)) improves translucent surfaces by blurring the **background behind the surface**. For a top-level window that is **not** live layers-below glass. When dogfood uses `layers-below` (C) and only window-behind is available, paint plan selects `compositor-window-blur` with **`degraded: true`** and an explicit reason. Liquid Glass remains **approximable** via snapshot/chrome (see materials.md); do not treat window-behind alone as non-degraded Liquid Glass.

Staging note: compositor support for `ext-background-effect-v1` is still rolling out; probe may report the global absent → translucent chrome path.

### Apply path (not yet: bind + set region)

Current spike **probes** globals and **plans** paint. Applying blur still TODO:

1. Obtain `wl_surface` for the material host / toplevel (`gdk_wayland_surface_get_wl_surface`).
2. Bind `ext_background_effect_manager_v1` (or KDE blur manager).
3. `get_background_effect` + `set_blur_region` for the material rect (surface-local).
4. Ensure translucent toplevel / alpha so the effect is visible.
5. Emit `material.degraded` only when path is degraded or capability drops at runtime.

Until apply lands, even a positive probe still paints translucent chrome in the widget tree; logs report the planned path honestly.

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
- [x] Portable `ShellSessionFeature` + `planMaterialPaint` in `@vela/api`
- [x] Wayland global → feature map + GDK registry probe (`vela_session`)
- [ ] Apply `ext-background-effect` / KDE blur to material region (paint path)
- [ ] Manual L1–L6 on Fedora-class Wayland/X11

## Platform pitfalls (Linux)

| Risk | Mitigation |
|------|------------|
| WebKit internal event handling vs overlays | Sole hit root; pick/controller policy before dual delivery |
| No live layers-below glass | Explicit degrade + diagnostics; do not pretend window-behind is layers-below |
| Wayland vs X11 input regions | Probe backend; Tier 2 partial for window-through; document session used |
| Staging protocols absent | Probe globals; fall back paint path; never silent-success |
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
