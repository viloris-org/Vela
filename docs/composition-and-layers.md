# Composition and Layers

The **Layer tree** is the composition source of truth for each window. A WebView
is one layer kind among several — not the only content root.

Accepted decisions: [ADR 0001](adr/0001-composition-hit-material.md).
Types: `packages/api/src/layer/types.ts` (`Layer`, `InsertLayerSpec`, …).

## Canonical stack (example)

```text
Window
└── RootLayer
    ├── underlay-native   (map / GPU / video)
    ├── web-main          (primary WebView)
    ├── native-slot       (camera, terminal, …)
    ├── material-glass    (Liquid Glass / Mica / …)
    ├── native-controls   (optional children of material)
    ├── web-overlay       (optional isolated WebView)
    └── chrome            (drag regions, system button hits)
```

**Draw order** and **default hit order** both follow `zIndex` (higher first for
hit-test). The Shell must not double-deliver the same pointer event to a WebView
and a sibling native view.

## Layer kinds

| Kind | Role | Default `HitPolicy` |
|------|------|---------------------|
| `webview` | Primary or overlay web content | `web-shaped` |
| `native` | Registered native component surface | `opaque` |
| `material` | System material (glass, mica, …) | `opaque` |
| `chrome` | Titlebar / drag / system buttons / custom chrome | `opaque` |
| `passthrough` | Spacer / reserved hole (no paint claim) | `transparent` |

Defaults are defined by `defaultHitPolicyForKind()` in `@vela/api`.

## Layer base fields

Every layer shares:

| Field | Meaning |
|-------|---------|
| `id` | Stable `LayerId` (assigned by Shell if omitted on insert) |
| `kind` | Discriminant |
| `bounds` | Logical rect in window content coordinates (origin top-left, y down) |
| `zIndex` | Stack order |
| `visible` | Visibility |
| `opacity` | Visual opacity (not hit policy) |
| `hitPolicy` | Layer↔layer hit behavior |
| `clip?` | Optional clip `Region` |
| `transform?` | v1: translate recommended for native/material; scale optional |

## Kind-specific fields

### WebView

- `url?` — content URL
- `preloadProfile?` — capability profile name from app manifest
- `capabilities?` — extra permission ids for this web content

### Native

- `component` — registered name, e.g. `"camera.preview"`
- `props?` — component-specific props (validated by host/plugin schema)

### Material

- `material` — `MaterialId` (see [Materials](materials.md))
- `shape` — axis-aligned shape (`rect` / `roundedRect` / `capsule` / `circle`)
- `samples` — `BackdropSource` (`layers-below` | specific layer | window content)
- `variant` — `regular` | `clear`
- `tint?` — optional color
- `interactive` — pointer-reactive glass where supported

### Chrome

- `role` — `titlebar` | `drag-region` | `system-buttons` | `custom`

### Passthrough

No extra fields. Useful for reserving a hole or coordinating layout without paint.

## Insert vs patch

**Insert** (`InsertLayerSpec`): create a layer. `id` optional until Shell assigns.

**Patch** (`LayerPatch`): partial update of bounds, zIndex, visibility, opacity,
hitPolicy, clip, props, url.

Host contract (`VelaWindow`):

```ts
insertLayer(spec: InsertLayerSpec): Layer | Promise<Layer>
updateLayer(id: LayerId, patch: LayerPatch): void | Promise<void>
removeLayer(id: LayerId): void | Promise<void>
listLayers(): readonly Layer[] | Promise<readonly Layer[]>
reorderLayer(id: LayerId, zIndex: number): void | Promise<void>
mountChild?(parentId, nativeSpec): Layer | Promise<Layer>  // material/native children
```

From web content, the preload bridge exposes a subset:

```ts
vela.layers.insert(spec)
vela.layers.update(id, patch)
vela.layers.remove(id)
```

## v1 placement constraints

- Native/material slots are **axis-aligned**.
- No list-cell-per-row native embedding.
- Scroll-linked native slots are **Phase 2**.
- Arbitrary CSS transform hitching of native siblings is deferred.

## Example (contracts only)

```ts
import type { InsertLayerSpec } from "@vela/api";

const glass: InsertLayerSpec = {
  kind: "material",
  material: "apple.liquidGlass",
  bounds: { x: 16, y: 12, width: 480, height: 52 },
  zIndex: 30,
  shape: { type: "capsule" },
  interactive: true,
  hitPolicy: { mode: "opaque" },
};

const camera: InsertLayerSpec = {
  kind: "native",
  component: "camera.preview",
  bounds: { x: 40, y: 80, width: 320, height: 180 },
  zIndex: 20,
  props: { facing: "front" },
};

const mainWeb: InsertLayerSpec = {
  kind: "webview",
  bounds: { x: 0, y: 0, width: 1280, height: 800 },
  zIndex: 10,
  url: "app://main/",
  preloadProfile: "default",
  hitPolicy: { mode: "web-shaped" },
};
```

## Qt analogy (brief)

| Qt | Vela |
|----|------|
| `QWidget` / `QQuickItem` tree | Layer tree |
| `raise()` / `stackUnder()` / Quick `z` | `zIndex` / `reorderLayer` |
| `setMask(QRegion)` / `containmentMask` | `HitPolicy.mask` + `Region` |
| `WA_TransparentForMouseEvents` | `HitPolicy.transparent` |
| `createWindowContainer` / foreign window | `kind: "native"` components |
| Child widgets of a container | `mountChild` under material/native |

Full mapping, pitfalls, and local `../qt6` notes: [Qt composition notes](qt-composition-notes.md).
