# Materials

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: `packages/api/src/material/spec.ts`, `material/paint-plan.ts`, `session/features.ts`; [ADR 0001](adr/0001-composition-hit-material.md) § D4

System materials are **first-class layers** (`kind: "material"`), not ad-hoc hacks or pure CSS fakes. Cross-platform policy is **semantic** (what is sampled, which quality bucket), not pixel-identical brand names.

Types: `packages/api/src/material/spec.ts`, `material/paint-plan.ts`, `session/features.ts`. Decisions: [ADR 0001 § D4](adr/0001-composition-hit-material.md). Linux session map: [linux-spike-architecture.md](linux-spike-architecture.md).

## Why not CSS-only?

True system materials **sample live surfaces** (layers below the material, or content behind the window). CSS `backdrop-filter` is a degraded path only, and only when the effective id is **`fallback.css`**.

| Id | Role |
|----|------|
| `apple.liquidGlass` | Apple Liquid Glass (native on supported macOS/iOS) |
| `apple.material` | Apple system material / vibrancy fallback |
| `win.mica` | Windows Mica (prefer Windows 11) |
| `win.acrylic` | Windows Acrylic (Windows 10 class; heavier live blur) |
| `win.smoke` | Windows smoke / subtle |
| `gtk.blur` | Linux best-effort system blur path |
| `fallback.css` | Explicit CSS fallback (no native material claim) |

Host paint stays platform-private; shared policy is `resolveMaterial` + `planMaterialPaint`. See [Cross-platform abstraction](cross-platform-abstraction.md).

## Material layer fields

| Field | Meaning |
|-------|---------|
| `material` | `MaterialId` (author intent) |
| `bounds` / `zIndex` | Placement in the layer tree |
| `shape` | `rect` \| `roundedRect` \| `capsule` \| `circle` |
| `samples` | `BackdropSource` — **what** is sampled under the glass |
| `variant` | `regular` \| `clear` |
| `tint?` | Optional color overlay |
| `interactive` | Pointer-reactive glass where the platform supports it |
| `hitPolicy` | Usually `opaque` for toolbars; mask for irregular chrome |
| `content?` | Optional hosted content (layer id or native subtree) |

### BackdropSource

```ts
{ type: "layers-below" }      // default for glass toolbars (in-window)
{ type: "layer", layerId: "..." } // sample a specific layer
{ type: "window-content" }    // whole-window / desktop-atmosphere policy
```

**Do not confuse the two common intents:**

| Intent | Typical `samples` | User sees |
|--------|-------------------|-----------|
| In-window glass (toolbar over WebView) | `layers-below` | Content **inside** this window under the chrome |
| Desktop atmosphere (see the desktop faintly) | `window-content` | Wallpaper / desktop / other windows **behind** this window |

## Semantic buckets (mapping axis)

Map **trademarks into buckets first**, then into platform `MaterialId`s and paint paths. Do not 1:1-rename Mica to a macOS type name.

| Bucket | Name | Look and feel | Cost tendency | Primary `samples` |
|--------|------|---------------|---------------|-------------------|
| **A** | Desktop atmosphere | Faint desktop / wallpaper behind the window | Lower (Mica-class) | `window-content` |
| **B** | Live window-behind | Stronger live blur of what is behind the surface | Higher (Acrylic-class) | `window-content` |
| **C** | In-window glass | Chrome samples **sibling layers** in the same window | Medium–high | `layers-below` |
| **D** | Soft fill | Translucent solid, no real sampling | Lowest | any |
| **E** | Explicit CSS | Web-only `backdrop-filter` etc. | Web compositor | — |

### Platform products → buckets

| Bucket | Windows | macOS | Linux |
|--------|---------|-------|-------|
| **A** Desktop atmosphere | **Mica** (Windows 11 preferred) | System material / vibrancy with **`behindWindow`** blending (lighter materials) | No dedicated “cheap wallpaper-only” API; same compositor path as B when present |
| **B** Live window-behind | **Acrylic** (Windows 10 class; optional on 11 when “more live” is wanted) | Stronger **`behindWindow`** vibrancy / materials | **Compositor window-behind** only: Wayland `ext-background-effect-v1`, KDE blur, etc. → feature `material.backdrop.window-behind` |
| **C** In-window glass | No first-class equal | **Liquid Glass** (native); else material + **`withinWindow`** | Snapshot / GSK layers-below (host); true live rare |
| **D** Soft fill | Smoke / flat chrome | Non-vibrancy fill | `translucent-chrome` paint path |
| **E** CSS | `fallback.css` | `fallback.css` | `fallback.css` |

### Windows generation note (Mica vs Acrylic)

| OS | Preferred for bucket A | Notes |
|----|------------------------|--------|
| Windows 11 | `win.mica` | Typically **lower cost** than Acrylic (desktop backdrop style, not full live blur every frame) |
| Windows 10 | `win.acrylic` | No Mica; Acrylic is the practical window-behind material |

Hosts should pass a runtime flag (intent: `supportsMica`, same pattern as `supportsLiquidGlass`) into `resolveMaterial` when the pure helper grows that option. Until then, Shell L4 still prefers Mica on 11 and Acrylic on 10 at paint time.

### Linux reality (buckets A and B)

On Linux desktop there is **no** portable Mica-class API. The same product class as “faintly see the desktop” is **only** compositor window-behind blur (and legacy compositor-specific blur). Accept that:

- A and B often **collapse** to one feature: `material.backdrop.window-behind`
- Effective id stays `gtk.blur`; distinction is `MaterialPaintPath` + reason, not a fake second id
- Missing global → **D** (`translucent-chrome`) with loud degrade — never silent success

Details and Wayland global map: [linux-spike-architecture.md](linux-spike-architecture.md).

### macOS note (behindWindow vs withinWindow)

| Blending | Bucket | Role |
|----------|--------|------|
| `behindWindow` | A / B | Sample desktop and other windows (see-desktop class) |
| `withinWindow` | C | Sample content in the same window (Liquid Glass class) |

Apple does **not** publish a Mica/Acrylic cost split; apps pick materials, the compositor owns cost.

## Liquid Glass is special (bucket C)

`apple.liquidGlass` is **not** the same product as Mica or “see the desktop.”

| | Liquid Glass (C) | Mica / window-behind (A/B) |
|--|------------------|----------------------------|
| Samples | Sibling layers **in this window** | Desktop / wallpaper / **other** clients |
| Native peers | Essentially **Apple-only** | Win Mica/Acrylic; mac behindWindow; Linux compositor blur |
| Cross-platform | **No native peer**, but **easy to approximate** (shape + stack + blur/snapshot) | Harder to invent if the compositor has no path |
| Pixel match | **Hard** to look “especially like” Apple glass | Also not pixel-identical across OS |

**Policy:**

1. Author intent `apple.liquidGlass` + default `samples: layers-below` means **bucket C**.
2. On Apple with `supportsLiquidGlass: true` → `effective: apple.liquidGlass`, path `native-system`, **`degraded: false`** only when native.
3. On every other platform → map to a local id (`win.mica` / `win.acrylic` / `gtk.blur` / `apple.material`) and paint an **approximation**:
   - Prefer **in-window** paths: `snapshot-blur`, within-window material, soft layered chrome
   - Using pure **window-behind** (see desktop) for a Liquid Glass request is allowed only as a weaker stand-in with **`degraded: true`** and a reason that says it is **not** in-window glass
4. Never report non-degraded success for `apple.liquidGlass` off Apple native glass.
5. CSS `backdrop-filter` may implement **E** only; it must not silently claim native Liquid Glass.

Approximation quality ladder (best → worst):

1. Native Liquid Glass (Apple only)
2. Snapshot / offscreen sample of layers-below + blur
3. Translucent shaped chrome over live siblings (weak depth)
4. Compositor window-behind (wrong sample target; degraded)
5. Flat translucent fill (D)
6. `fallback.css` (E)

“Easy to simulate” means steps **2–3** already support dogfood toolbars. “Hard to look especially like” is why **degraded remains correct** even when the UI is usable.

## Resolution pipeline (three steps)

```text
App request
  material: MaterialId          // author intent (may be foreign to this OS)
  samples:  BackdropSource      // A/B vs C

        │
        ▼
1) resolveMaterial(platform, options?)
        → effective MaterialId + preference-level degraded?
        │
        ▼
2) ShellSessionProbe (runtime)
        → features: material.backdrop.window-behind | layers-below | snapshot | …
        │
        ▼
3) planMaterialPaint(requested, platform, { session, samples })
        → MaterialPaintPath + paint-time degraded + reason
        │
        ▼
L4 private APIs
  Win: DWM Mica / Acrylic
  Mac: Liquid Glass / NSVisualEffect behindWindow | withinWindow
  Linux: ext-background-effect / KDE blur / GSK snapshot / translucent chrome
```

| Step | Helper | Answers |
|------|--------|---------|
| 1 | `resolveMaterial` | Which **id** do we claim on this OS? |
| 2 | `ShellSessionProbe` | What can this **session** actually do? |
| 3 | `planMaterialPaint` | How do we **paint**, and is it honest? |

Page JS never sees Wayland interface names or DWM enums — only portable ids, paths, and diagnostics.

### `resolveMaterial` intent table

Policy preference (not a paint guarantee). Foreign ids set `degraded: true` at this step when remapped.

| Requested \ platform | macOS / iOS | Windows 11 (Mica OK) | Windows 10 (no Mica) | Linux |
|----------------------|-------------|----------------------|----------------------|-------|
| `apple.liquidGlass` | liquid if supported, else `apple.material` | → `win.mica` (degraded; not C) | → `win.acrylic` (degraded) | → `gtk.blur` (degraded) |
| `apple.material` | `apple.material` | → `win.mica` (degraded) | → `win.acrylic` (degraded) | → `gtk.blur` (degraded) |
| `win.mica` | → `apple.material` (degraded) | `win.mica` | → `win.acrylic` (degraded) | → `gtk.blur` (degraded) |
| `win.acrylic` | → `apple.material` (degraded) | `win.acrylic` or host policy | `win.acrylic` | → `gtk.blur` (degraded) |
| `win.smoke` | → `apple.material` (degraded) | `win.smoke` | `win.smoke` | → `gtk.blur` (degraded) |
| `gtk.blur` | → `apple.material` (degraded) | → `win.mica` (degraded) | → `win.acrylic` (degraded) | `gtk.blur` |
| `fallback.css` | unchanged | unchanged | unchanged | unchanged |

Current pure helper may still map some Windows foreign materials more coarsely (e.g. always prefer Mica for Apple ids). Hosts and future `supportsMica` options should converge on this table. **Paint honesty is always step 3.**

### `planMaterialPaint` paths

| Path | Meaning |
|------|---------|
| `native-system` | Real OS material (Liquid Glass, Mica, Acrylic, live layers-below) |
| `compositor-window-blur` | Blur/sample **behind the window surface** (A/B; Linux Wayland/KDE) |
| `snapshot-blur` | Host snapshot of layers-below + blur (C approximation) |
| `translucent-chrome` | Soft fill, no sampling (D) |
| `css-fallback` | Explicit `fallback.css` (E) |

| `samples` | Prefer | If missing capability |
|-----------|--------|------------------------|
| `layers-below` (C) | `native-system` or `snapshot-blur` | window-behind only → `compositor-window-blur` + **degraded** (wrong target); else D |
| `window-content` (A/B) | `native-system` (Mica/Acrylic/behindWindow) or `compositor-window-blur` | D with `no-backdrop-blur` |
| `layer` | Host-specific; often degrades like layers-below | same |

### Suggested default requests (authors)

| Scenario | Request | Notes |
|----------|---------|--------|
| Toolbar glass over WebView | `apple.liquidGlass` + `layers-below` | Best on Apple; elsewhere approximate C, degraded |
| Side chrome / “see desktop” | `win.mica` + `window-content` | A; Win10 → Acrylic; Linux → compositor or D |
| Stronger live window blur | `win.acrylic` + `window-content` | B |
| Linux dogfood toolbar | `gtk.blur` + `layers-below` | Spike may plan window-behind + degraded until snapshot exists |

## Platform resolution (summary)

| Platform | Preferred ids | Typical degrade |
|----------|---------------|-----------------|
| macOS / iOS | `apple.liquidGlass` if supported, else `apple.material` | foreign ids → `apple.material` |
| Windows | `win.mica` / `win.acrylic` / `win.smoke` | Apple / Linux ids → mica or acrylic by generation |
| Linux | `gtk.blur` | other → `gtk.blur` (best effort) |
| Android / unknown | — | `fallback.css` + `degraded: true` |

Result of step 1: `ResolvedMaterial` (`requested`, `effective`, `platform`, `degraded`, optional `reason`).  
Result of step 3: `MaterialPaintPlan` (`path`, paint-time `degraded`, `reason`, embeds `resolved`).

### Linux paint honesty (`gtk.blur`)

Pure `resolveMaterial(..., "linux")` prefers `gtk.blur` with `degraded: false` as a **policy preference**, not a compositor guarantee. Hosts then call **`planMaterialPaint`** with a runtime `ShellSessionProbe`:

```ts
import { planMaterialPaint, type ShellSessionProbe } from "@vela/api";

const session: ShellSessionProbe = {
  platform: "linux",
  displayBackend: "wayland",
  features: ["material.backdrop.window-behind"], // from host probe
};

const plan = planMaterialPaint("gtk.blur", "linux", {
  session,
  samples: { type: "layers-below" },
});
// → path: "compositor-window-blur", degraded: true (window-behind ≠ layers-below)
```

| Path | When | Diagnostics |
|------|------|-------------|
| `native-system` | Live layers-below (rare on Linux) | Non-degraded only if truly live |
| `snapshot-blur` | Host snapshot + blur of layers-below | `degraded: true` (C approximation) |
| `compositor-window-blur` | `material.backdrop.window-behind` (e.g. `ext-background-effect-v1`, KDE blur) | Non-degraded for `window-content` (A/B); for `layers-below` still degraded |
| `translucent-chrome` | No compositor/snapshot path | `degraded: true`, `no-backdrop-blur` |
| `css-fallback` | `fallback.css` | Do not claim native `gtk.blur` |

CSS `backdrop-filter` is legitimate only for **`fallback.css`**. Session features: `session/features.ts`. Paint plan: `material/paint-plan.ts`. Wayland map: [linux-spike-architecture.md](linux-spike-architecture.md).

## HIG guidance (Apple)

Prefer materials on the **functional** layer (chrome, toolbars, transient controls), not dense document content. Prefer GlassEffectContainer-style multi-control fusion when multiple controls sit on one glass surface (`content` / `mountChild`).

### Apple API surface (implementation direction)

| Piece | Role |
|-------|------|
| SwiftUI `glassEffect(_:in:)` | Primary Liquid Glass paint on custom chrome (bucket C) |
| `GlassEffectContainer` | Shared sampling / morph for multiple glass controls |
| `.interactive()` | Pointer-reactive glass where hardware/OS supports it |
| `regular` / `clear` variants | Map to `MaterialVariant` |
| Shape (Capsule, rounded rect, …) | Map to layer `shape` |
| `NSVisualEffectView` + `behindWindow` | Bucket A/B see-desktop class |
| Older OS / no Liquid Glass | `apple.material`; `degraded: true` when liquid was requested |

Availability is OS-gated (Liquid Glass on current Apple major releases; treat `supportsLiquidGlass` as a runtime/SDK probe). See Apple docs: [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views).

### Implementation pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Ancestor `.clipped()` / mask kills glass | Keep material host outside clipped web scroll containers |
| Faking glass with CSS only | Forbidden for `kind: "material"` except `fallback.css` |
| Silent degrade | Emit diagnostics / `material.degraded`; set reason on resolve and paint plan |
| Claiming Liquid Glass via window-behind only | Allowed as weak stand-in only with **degraded** + explicit reason |
| Claiming Mica cost on Linux | Do not; Linux A/B share compositor blur or D |
| Dense text under clear glass | Prefer `regular` + functional-layer placement |
| Snapshot tests of live glass | Specular/orientation variance — pin or exclude glass in golden tests |

macOS hosting pattern: [macOS spike architecture](macos-spike-architecture.md).

## Permission

Inserting system material layers should require `window:material` (see [Capabilities](capabilities-and-plugins.md)). Hosts must enforce this even if web code calls `vela.layers.insert`.

## Example

```ts
import type { InsertLayerSpec } from "@vela/api";
import { resolveMaterial, planMaterialPaint } from "@vela/api";

const toolbar: InsertLayerSpec = {
  kind: "material",
  material: "apple.liquidGlass",
  bounds: { x: 16, y: 12, width: 480, height: 52 },
  zIndex: 30,
  shape: { type: "capsule" },
  samples: { type: "layers-below" },
  variant: "regular",
  interactive: true,
};

const resolved = resolveMaterial("apple.liquidGlass", "windows");
// → effective: "win.mica", degraded: true  (id remap; not native glass)

const plan = planMaterialPaint("apple.liquidGlass", "linux", {
  samples: { type: "layers-below" },
  session: {
    platform: "linux",
    displayBackend: "wayland",
    features: ["material.backdrop.window-behind"],
  },
});
// → effective gtk.blur, path compositor-window-blur, degraded: true
//    (see-desktop stand-in for in-window glass — honest, not silent success)
```

## Spike targets

| Host | Material goal |
|------|----------------|
| macOS Phase 1 | Native Liquid Glass toolbar + hole hit-test — [macos-spike-architecture.md](macos-spike-architecture.md) |
| Linux Phase 1L | `gtk.blur` + session probe + paint plan; apply compositor blur later — [linux-spike-architecture.md](linux-spike-architecture.md) |

Acceptance: [Testing and acceptance](testing-and-acceptance.md) (S1–S2 materials; L1–L6 on Linux). Qt has no single portable “Liquid Glass” API — see [Qt composition notes](research/qt-composition-notes.md).

## Related

- [Cross-platform abstraction](cross-platform-abstraction.md) — shared vs L4-private
- [Platform support](platform-support.md) — tiers and feature matrix
- [API contracts](api-contracts.md) — module map
- [ADR 0001](adr/0001-composition-hit-material.md) — composition and materials decision
- [Linux spike architecture](linux-spike-architecture.md) — Wayland feature map
- [macOS spike architecture](macos-spike-architecture.md) — Apple glass hosting
