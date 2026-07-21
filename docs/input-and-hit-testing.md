# Input and hit testing

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/src/hit/policy.ts`; [ADR 0001](adr/0001-composition-hit-material.md) § D2–D3

Vela splits input into **two levels**. Conflating them causes wrong product behavior (annotator tools vs map-under-web holes).

Types: `packages/api/src/hit/policy.ts`. Decisions: [ADR 0001 § D2 - D3](adr/0001-composition-hit-material.md).

## Two levels

| Level | Type | Meaning |
|-------|------|---------|
| Window → OS | `WindowInputMode` | Click-through to *other applications* / desktop |
| Layer ↔ Layer | `HitPolicy` | Partial pass-through among layers *inside* the app |

Examples:

- Annotator-style “hole to desktop” → `WindowInputMode`
- “Web UI with hole to map underlay” → `HitPolicy` on the web (and maybe
intermediate) layers

## WindowInputMode

| Mode | Behavior |
|------|----------|
| `normal` | Window receives hits normally |
| `click-through` | Entire window ignores hits (Flutter-style all-or-nothing) |
| `region-through` | Only listed `Region` passes through to desktop / windows below |
| `shaped` | Window outline + hit outline (`Region`) |

Set via `CreateWindowOptions.inputMode` or `VelaWindow.setInputMode`.

## HitPolicy (layer)

| Mode | Behavior |
|------|----------|
| `opaque` | Full `bounds` receive hits |
| `transparent` | Layer ignored for hit-test |
| `mask` | Only `region: Region` receives hits |
| `web-shaped` | Web reports opaque regions (or point queries); rest passes through |
| `callback` | Shell asks native surface (e.g. Swift shape `hitTest`) when mask is insufficient |

### Deferred (not v1)

- Per-pixel alpha threshold hit-testing (expensive)
- Arbitrary CSS-transform-driven native hitching

## Hit order algorithm (v1 intent)

Canonical executable description for macOS (view tree, `hitTest` ownership): [macOS spike architecture](macos-spike-architecture.md).

1. If `WindowInputMode` says the point is through to the OS → target is
`os-desktop` (or equivalent); stop.
2. Walk layers by **descending `zIndex`** among visible layers whose bounds
(after optional transform) contain the point.
3. For each layer, apply `hitPolicy` (+ `clip` if set).
4. First accepting layer wins → `HitTarget` with `kind`, optional `layerId`,
`localPoint`.
5. Shell delivers the event **once** to that target. No dual delivery to WebView
and overlay native.

`HitTargetKind`: `os-desktop` | `window-background` | `chrome` | `webview` | `native` | `material`.

**Contract gap:** a pure `resolveHit(...)` helper should live in `@vela/api` so hosts mirror one algorithm (see [design gaps](design-gaps.md) G-P0-1). Until then, hosts must follow this section and the spike doc exactly.

**Coordinates:** logical window content, origin top-left, y down. Platform APIs that use a different origin (e.g. AppKit) convert **once** at the Shell boundary.

## Web-shaped workflow

Default for `webview` layers is `web-shaped`.

1. App UI decides which DOM regions should capture pointers (buttons, lists, …).
2. Web → Shell:

```ts
vela.hit.setOpaqueRegions({
  layerId: "...",
  opaqueRegions: { primitives: [/* rects / rounded / capsule / circle */] },
  generation: 42, // optional stale rejection
});

// or convenience for main web layer:
vela.hit.setMainOpaqueRegions(region);
```

3. Points outside opaque regions fall through to lower layers (map, video,
native slot, material chrome underlay, etc.).

**Defaults for dogfood (Phase 1):** a new `webview` layer starts as `web-shaped` with **empty** opaque regions until the page reports UI, so underlay holes work immediately. Production apps should push regions for all interactive chrome on load.

**Stale updates:** if `generation` is present, Shell keeps `lastAcceptedGeneration` and **drops** updates with a smaller generation (`generation.stale` when RPC exists). Prefer always sending monotonic generations in dogfood.

Optional future: `WebShapePointQuery` for Shell-driven point probes when region updates are too coarse.

## Region and geometry

Logical pixels, window content coordinates, origin top-left, y down.

`Region` is a **union of primitives** (v1 - no arbitrary paths):

- `rect`
- `roundedRect` + `CornerRadius`
- `capsule` (from rect)
- `circle` (center + radius)

Helpers: `regionFromRect`, `regionFromRoundedRect`, `regionUnion`, `rectContains`.

## Chrome and system buttons

`chrome` layers with roles `drag-region` / `system-buttons` / `titlebar` must participate in hit order so OS chrome behavior (move window, traffic lights) works without the main WebView swallowing those hits.

## Qt-class parallels (brief)

| Concern | Qt | Vela |
|---------|----|------|
| In-app pass-through | `WA_TransparentForMouseEvents`, masks, Quick `contains` | `HitPolicy` |
| Top-level → OS | `WindowTransparentForInput`, top-level `setMask` | `WindowInputMode` |
| Custom shape without full alpha | `containmentMask`, region masks | `mask` / `callback` / `web-shaped` |
| Foreign surface input | `createWindowContainer` focus fights | Shell single `HitTarget` |

Details: [Qt composition notes](research/qt-composition-notes.md). Host gates: [Testing and acceptance](testing-and-acceptance.md).

## Platform pitfalls

| Platform | Risk | Shell duty |
|----------|------|------------|
| macOS WKWebView + NSView siblings | Double event delivery; parent `hitTest` swallowing WebView | Single `VelaHitRootView` policy; WebView as **sibling** of overlays - see [macOS spike](macos-spike-architecture.md) |
| macOS custom canvas parent | Framework canvas returns `self` from hitTest → dead clicks in child WKWebView | Do not parent WebView under such canvases |
| Windows WebView2 + composition | Hit-test order vs visual order | Align with zIndex truth |
| Linux (WebKitGTK / etc.) | Weaker material + shaped window support | Degrade cleanly; document Tier |
| Any OS click-through flag | Sticky OS input-transparent after unset (Qt-class footgun) | Track `WindowInputMode` independently of layer `HitPolicy` |
| Electron-class window ignore-mouse | Whole-window (or forward-move) APIs ≠ in-app layer holes | Never implement `HitPolicy` via OS-only ignore flags alone |

## Acceptance checklist (host)

Hit work is not done for a host until:

- [ ] Annotator-style `region-through` does not break in-app layer holes
- [ ] Web hole over map underlay works without stealing map pan when outside UI
- [ ] Opaque glass toolbar receives hits; transparent margins do not
- [ ] Chrome drag / system buttons work with custom chrome
- [ ] No double-click / double-focus on WebView + native sibling
- [ ] Stale `web-shaped` updates rejected when `generation` is used
