# macOS Phase 1 spike architecture

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Phase 1 executable design; product contracts remain `@vela/api` + ADRs

Executable design for **Phase 1**: prove Qt-class composition on macOS with WKWebView + system material (Liquid Glass) + **regional** hit-through, without double event delivery.

Status: design - host code not shipped. Contracts: `@vela/api`. Decisions: [ADR 0001](adr/0001-composition-hit-material.md). Acceptance scenarios: [Testing and acceptance](testing-and-acceptance.md) S1 - S7.

Related research notes: [Input and hit testing](input-and-hit-testing.md), [Materials](materials.md), [Design gaps](design-gaps.md). Cross-host shape: [Cross-platform abstraction](cross-platform-abstraction.md), [ADR 0004](adr/0004-cross-platform-abstraction.md). Desktop Bun glue later: [ADR 0005](adr/0005-zig-interop-layer.md) (Zig; **not required for Phase 1 spike**).

## Goals / non-goals

### Goals

1. One window with multi-kind layers: underlay + `webview` + `material` (+ optional `chrome`).
2. Shell-owned hit router: **one** `HitTarget` per pointer down.
3. `web-shaped` holes from Web → Shell via `vela.hit`.
4. True system material toolbar (`apple.liquidGlass` when available; else `apple.material` + `degraded`).
5. Preload inject subset of `window.vela` (`layers`, `hit`; `call`/`events` stub ok).

### Non-goals (Phase 1)

- Bun host process split (see [ADR 0002](adr/0002-ipc-privilege.md) - stub allowed).
- Full capability engine / plugin ABI.
- Scroll-linked native slots, per-pixel alpha hit, CSS-transform hitching.
- Windows / Linux hosts.
- Pixel-identical glass across OS versions.

## Recommended process shape (Phase 1)

| Mode | Shape | When |
|------|--------|------|
| **Spike default** | Single native process (Swift macOS app) implements Shell + thin local preload bridge | Prove hit + materials fastest |
| Phase 2 | Bun orchestration process + Shell process, Unix socket RPC | [ADR 0002](adr/0002-ipc-privilege.md) |

Phase 1 may keep Bun out of the critical path; dogfood content can be loaded as local files / temporary `file://` or a minimal custom scheme. Production `app://` packaging is Phase 2.

## View tree (AppKit)

All composition surfaces are **siblings** under a single hit root. Do **not** parent WKWebView under a custom canvas that returns `self` from `hitTest`.

```text
NSWindow
└── contentView = VelaHitRootView ← sole hitTest override
    ├── UnderlayNativeView                 zIndex 0..9   (map / video / color stub)
    ├── MainWKWebView                      zIndex 10     (primary web)
    ├── NativeSlotView?                    zIndex 20     (optional camera stub)
    ├── MaterialHostView                   zIndex 30     (NSHostingView + glass)
    └── ChromeHitViews                     zIndex 40     (drag-region / system-buttons)
```

### Hard rules

| Rule | Reason |
|------|--------|
| `VelaHitRootView` is the **only** policy hitTest owner | Single delivery; layer tree is truth |
| WKWebView is a **sibling** of material/native, not child of a drawing canvas | Custom parents that `return self` starve the webview of clicks |
| Draw order and hit order both follow Shell `zIndex` | Matches ADR 0001 D1 |
| Opacity never implies hit policy | ADR / acceptance: opacity ≠ hit |
| Mouse-move / enter / exit use the **same** topmost policy as mouse-down | Align with WebKit topmost tracking direction |

### Material host

```text
MaterialHostView
└── NSHostingView<ToolbarRoot>
      └── GlassEffectContainer { … }   // multi-control fusion when needed
            .glassEffect(.regular[.interactive()], in: Capsule / RoundedRect)
```

- Prefer SwiftUI `glassEffect` / `GlassEffectContainer` on **macOS Tahoe+** when
Liquid Glass is available.
- Older OS: `NSVisualEffectView` (or equivalent) as `apple.material`, set
`ResolvedMaterial.degraded = true` with reason.
- Do not fake Liquid Glass with CSS inside the WebView for the material layer.
- Avoid ancestor `.clipped()` / masks that kill glass sampling (SwiftUI pitfall).

HIG: materials on the **functional** layer (toolbar/chrome), not dense document content. See [Materials](materials.md).

## Hit router ownership

```text
                    ┌─────────────────────┐
  NSEvent ─────────▶│ VelaHitRootView     │
                    │  hitTest(_:)        │
                    └──────────┬──────────┘
                               │ uses snapshot of Layer tree
                               ▼
                    resolveHit(windowMode, layers, point)
                               │
                               ▼
                         HitTarget (kind, layerId?, localPoint)
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         WKWebView      MaterialHost     Underlay/Native/Chrome
         (if web)       (if material)    (if that kind)
```

**Shell must not** also let AppKit default sibling traversal disagree with `resolveHit`. Prefer: root `hitTest` returns the concrete NSView for the winning layer (or `nil` / window background policy for OS pass-through cases).

### Algorithm (v1 - must match future pure helper)

```text
resolveHit(windowMode, layers, point) → HitTarget:

  1. If WindowInputMode says the point is OS-through
       → { kind: "os-desktop", localPoint: point }; stop.

  2. Consider only visible layers whose bounds (after optional transform)
     contain point. Sort by zIndex descending.

  3. For each layer in order:
       a. Apply clip Region if present; skip if outside clip.
       b. Apply hitPolicy:
            opaque       → accept
            transparent  → skip
            mask         → accept iff region contains point
            web-shaped   → accept iff opaqueRegions contains point
                           (reject stale generation - see below)
            callback     → ask native surface (Phase 1: may stub false / skip)
       c. First accept wins.

  4. If none → { kind: "window-background", localPoint: point }.

  5. Deliver the event ONCE to the NSView bound to that layer.
```

Coordinate space: **logical window content**, origin top-left, y down (same as `@vela/api` geometry). Convert from AppKit bottom-left at the Shell boundary exactly once.

### web-shaped state

| Field | Role |
|-------|------|
| `layerId` | Target webview layer |
| `opaqueRegions` | Union of primitives that capture hits |
| `generation` | Monotonic; Shell keeps `lastAcceptedGeneration` |

- Updates with `generation < lastAccepted` are **dropped**.
- Missing generation: last-write-wins (document in host; prefer always sending generation in dogfood).
- Default for new webview layers: `hitPolicy: web-shaped` with **empty** opaque
regions until the page reports UI (so underlay is reachable for hole demos). Dogfood should push regions for buttons/panels immediately on load.

Bridge (already in `@vela/api`):

```ts
vela.hit.setOpaqueRegions({ layerId, opaqueRegions, generation });
vela.hit.setMainOpaqueRegions(region);
```

## Preload (Phase 1 subset)

Inject into the main WKWebView only:

| API | Phase 1 |
|-----|---------|
| `vela.version` | required |
| `vela.layers.insert/update/remove` | required (may be Shell-local) |
| `vela.hit.setOpaqueRegions` / `setMainOpaqueRegions` | required |
| `vela.call` | optional stub (deny-all or allowlisted no-ops) |
| `vela.events.subscribe` | optional; recommend `material.degraded` + debug hit channel |

No Node, no FFI, no arbitrary eval bridge. Message pass only - even in-process.

## Layer insert path (spike)

Dogfood may insert layers from:

1. Shell bootstrap (underlay + main web + glass toolbar), and/or
2. Page via `vela.layers.insert` (still permission-checked when cap engine exists).

Phase 1 permission enforcement can be **hard-coded allow** for dogfood **or** a minimal check for `window:material` / `camera:preview`. Do not ship “silent success” for camera without a grant path once Phase 2 lands.

## Platform pitfalls (macOS)

| Risk | Mitigation |
|------|------------|
| Parent `hitTest` returns self → dead WebView | Sibling tree under `VelaHitRootView` |
| Double delivery WebView + overlay | Root-only policy; no secondary mouse forward into both |
| WKWebView mouse tracking vs overlays | Same topmost policy for move/enter/exit |
| Glass killed by clip/mask | Keep material host outside clipped web scrollers |
| Liquid Glass OS gate | `resolveMaterial(..., { supportsLiquidGlass })` + degrade event |
| Sticky OS click-through | Track `WindowInputMode` separately from layer `HitPolicy` |

## Dogfood content (minimum)

1. Full-client underlay (solid color or map/video stub).
2. Main WebView with floating panel + large hole (`web-shaped` regions).
3. Capsule material toolbar (`apple.liquidGlass` / degraded material).
4. Debug HUD: last `HitTarget.kind` + `layerId` (overlay or native label).
5. Toggle later: `WindowInputMode.region-through` (S3) once window APIs exist.

## Exit criteria

Phase 1 is done when:

- [ ] Demo app (or short video) covers [S1 - S6](testing-and-acceptance.md) (S7 if generation used).
- [ ] No dual focus/click in instrumentation.
- [ ] Material either true glass or explicit degraded path with reason.
- [ ] Layer operations driven by the same `InsertLayerSpec` shapes as `@vela/api`.
- [ ] Notes from implementation fed back into this doc + [design-gaps](design-gaps.md).

## Implementation checklist

- [ ] Xcode macOS target; Swift Shell package under planned `hosts/desktop-shell` (or spike folder).
- [ ] `VelaHitRootView` + layer → NSView map.
- [ ] WKWebView creation, navigation, preload script injection.
- [ ] Material host (glassEffect or visual effect fallback).
- [ ] web-shaped region store + generation.
- [ ] Optional: port `resolveHit` pure logic to TS tests first, then mirror in Swift.
- [ ] Manual S1 - S6 script.

## References

- Apple: [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)
- Apple: `NSView.hitTest(_:)`
- WebKit: mouse tracking / topmost hit work (overlapping web views / overlays)
- Electron contrast: window-level `setIgnoreMouseEvents` ≠ layer holes; WebContentsView pass-through still incomplete
- Internal: [ADR 0001](adr/0001-composition-hit-material.md), [ADR 0002](adr/0002-ipc-privilege.md)
