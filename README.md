# Vela

Bun-centered GUI framework for **desktop + mobile**:

- **WebView-first** application UI (any web stack)
- **Native Shell** owns windowing, composition, and hit-testing
- **Qt-class layers**: stack Web, native views, and system materials with **regional** hit-through (not whole-window-only)
- **System materials** (e.g. Apple Liquid Glass via Swift) as first-class layers
- **Capability** permissions for system APIs (default deny)

> Status: architecture + shared TypeScript contracts. Hosts (Bun desktop shell, iOS/Android) are not implemented yet.

## Positioning

| System | Model | Vela’s angle |
|--------|--------|----------------|
| Electron | Chromium + Node | Lighter system WebView + Bun host; stronger multi-layer native composition |
| Flutter desktop | Often whole-window mouse ignore | Regional holes between Web / native / material |
| Tauri 2 | WebView + Core + commands/capabilities | Same security class; layers/materials/hit as first-class contracts |
| Qt Widgets / Quick | Stacking, masks, partial event transparency | Same *class* of composition, WebView-first, not Qt at runtime |
| Sibling Rust `Vela` (wgpu) | Retained native + GPU viewports | Different product — no WebView core |

References: [Qt composition notes](docs/qt-composition-notes.md) ·
[Tauri comparison](docs/tauri-comparison.md) (process/IPC/security — not a runtime).

## Monorepo

```
New_Vela/
  docs/               Architecture, domain guides, ADRs
  packages/api/       @vela/api — shared contracts (usable today)
  hosts/              (planned) desktop-bun, desktop-shell, ios, android
  plugins/            (planned) camera, materials, …
  apps/               (planned) playground
```

## Quick start

Requires [Bun](https://bun.sh).

```bash
cd /path/to/New_Vela
bun install
bun test
bun run typecheck
```

## Core ideas

| Concept | Role |
|---------|------|
| `Layer` | Composition unit: webview / native / material / chrome / passthrough |
| `HitPolicy` | In-app regional hit-through between layers |
| `WindowInputMode` | Window → OS click-through (annotator-style) |
| `MaterialId` | `apple.liquidGlass`, `win.mica`, … with platform fallback |
| `defineNativeComponent` | Register UI-bearing native plugins |
| `Capability` | Permission gate for system APIs |

## Documentation

Full index and reading order: **[docs/README.md](docs/README.md)**.

| Doc | Purpose |
|-----|---------|
| [Architecture](docs/architecture.md) | Split, principles, security spine |
| [Composition and layers](docs/composition-and-layers.md) | Layer kinds, stack, insert/update |
| [Input and hit testing](docs/input-and-hit-testing.md) | Two-level input model |
| [Materials](docs/materials.md) | System materials + fallbacks |
| [Capabilities and plugins](docs/capabilities-and-plugins.md) | Permissions, native components, bridge |
| [API contracts](docs/api-contracts.md) | `@vela/api` module map |
| [Technology stack](docs/technology-stack.md) | Host/runtime choices |
| [Platform support](docs/platform-support.md) | Tiers and feature matrix |
| [Roadmap](docs/roadmap.md) | Phased delivery |
| [Testing and acceptance](docs/testing-and-acceptance.md) | Host smoke gates |
| [Qt composition notes](docs/qt-composition-notes.md) | Qt Widgets/Quick → Vela map |
| [Tauri comparison](docs/tauri-comparison.md) | Tauri 2 process/IPC/security reference |
| [ADR index](docs/adr/README.md) | Decision records |

Accepted core ADR: [0001 — Composition, hit, materials](docs/adr/0001-composition-hit-material.md).

External study refs: Qt 6 public docs (and optional local `../qt6`); Tauri 2
docs for capability/IPC patterns — see [Tauri comparison](docs/tauri-comparison.md).

## Example (contract only)

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
```

## Roadmap (near term)

1. ~~ADR + `@vela/api` contracts~~
2. macOS spike: WebView + Liquid Glass toolbar + hole hit-test
3. Bun host + typed RPC / preload bridge
4. Capability plugins (fs, dialog, clipboard, notify)
5. Mobile hosts sharing the same contracts

Full plan: [docs/roadmap.md](docs/roadmap.md).

## License

TBD
