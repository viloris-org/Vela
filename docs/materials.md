# Materials

System materials are **first-class layers** (`kind: "material"`), not ad-hoc
hacks or pure CSS fakes.

Types: `packages/api/src/material/spec.ts`.
Decisions: [ADR 0001 § D4](adr/0001-composition-hit-material.md).

## Why not CSS-only?

True Liquid Glass / Mica / Acrylic must **sample live surfaces** in the same
window compositor (layers below, or window content). CSS `backdrop-filter` is a
degraded path only:

| Id | Role |
|----|------|
| `apple.liquidGlass` | Apple Liquid Glass (Swift / system) |
| `apple.material` | Apple system material fallback |
| `win.mica` | Windows Mica |
| `win.acrylic` | Windows Acrylic |
| `win.smoke` | Windows smoke / subtle |
| `gtk.blur` | Linux best-effort blur |
| `fallback.css` | Explicit CSS fallback (no native material) |

Cross-platform API is **semantic** (“system material”), not pixel-identical.

## Material layer fields

| Field | Meaning |
|-------|---------|
| `material` | `MaterialId` |
| `bounds` / `zIndex` | Placement in the layer tree |
| `shape` | `rect` \| `roundedRect` \| `capsule` \| `circle` |
| `samples` | `BackdropSource` — what is sampled under the glass |
| `variant` | `regular` \| `clear` |
| `tint?` | Optional color overlay |
| `interactive` | Pointer-reactive glass where platform supports it |
| `hitPolicy` | Usually `opaque` for toolbars; mask for irregular chrome |
| `content?` | Optional hosted content (layer id or native subtree) |

### BackdropSource

```ts
{ type: "layers-below" }           // default for glass toolbars
{ type: "layer", layerId: "..." }  // sample a specific layer
{ type: "window-content" }         // whole window content policy
```

## Platform resolution

`resolveMaterial(requested, platform, options?)` maps a request to what the
platform can paint. Pure helper for hosts; Shell may mirror the same rules
natively.

| Platform | Preferred | Typical degrade |
|----------|-----------|-----------------|
| macOS / iOS | `apple.liquidGlass` if supported, else `apple.material` | foreign ids → `apple.material` |
| Windows | `win.mica` / `win.acrylic` / `win.smoke` | Apple ids → `win.mica` |
| Linux | `gtk.blur` | other → `gtk.blur` (best effort) |
| Android / unknown | — | `fallback.css` + `degraded: true` |

Result shape: `ResolvedMaterial` with `requested`, `effective`, `platform`,
`degraded`, optional `reason`.

## HIG guidance (Apple)

Prefer materials on the **functional** layer (chrome, toolbars, transient
controls), not dense document content. Prefer
GlassEffectContainer-style multi-control fusion when multiple controls sit on
one glass surface (`content` / `mountChild`).

## Permission

Inserting system material layers should require `window:material` (see
[Capabilities](capabilities-and-plugins.md)). Hosts must enforce this even if
web code calls `vela.layers.insert`.

## Example

```ts
import type { InsertLayerSpec } from "@vela/api";
import { resolveMaterial } from "@vela/api";

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
// → effective: "win.mica", degraded: true
```

## Spike target

Near-term dogfood: macOS WebView + Liquid Glass toolbar + hole hit-test under
the glass chrome. Success criteria: [Roadmap](roadmap.md) Phase 1 and
[Testing and acceptance](testing-and-acceptance.md) scenarios S1–S2.

Qt has no single portable “Liquid Glass” API; materials are platform extras.
Vela keeps them as semantic `MaterialId`s rather than re-exporting DWM/AppKit
types — see [Qt composition notes](qt-composition-notes.md).
