# Vela

> **Status**: architecture and shared TypeScript contracts. Hosts (desktop privileged host, native shell, iOS/Android) are not implemented yet.

**TypeScript-first full stack** GUI framework (desktop and mobile): WebView App TS, privileged Host TS, and a native Shell for composition.

- **WebView-first** application UI (any web stack) — App TS only uses `window.vela`
- **Privileged Host TS** for capability plugins (desktop **reference** runtime: Bun; mobile: same plugin source on pluggable backends; see [ADR 0007](docs/adr/0007-typescript-full-stack-host.md))
- **Zig systems surface** for first-party portable OS/hot-path kernels behind Host TS — anti-scatter, not multi-language author imports ([ADR 0008](docs/adr/0008-zig-systems-surface.md))
- **Native Shell** owns windowing, composition, and hit-testing
- **Qt-class layers**: stack Web, native views, and system materials with **regional** hit-through (not whole-window-only)
- **System materials** (for example Apple Liquid Glass via Swift) as first-class layers
- **Capability** permissions for system APIs (default deny)
- **iOS/Android**: App TS reaches OS features **indirectly** via the same bridge; device packages need not embed Bun
- **Bun** is the **repo toolchain** and **desktop reference Host** — not a performance requirement and not required inside mobile app packages

## Positioning

| System | Model | Vela’s angle |
|--------|--------|----------------|
| Electron | Chromium + Node | Lighter system WebView + privileged Host TS; stronger multi-layer native composition |
| Flutter desktop | Often whole-window mouse ignore | Regional holes between Web / native / material |
| Tauri 2 | WebView + Core + commands/capabilities | Same security class; layers, materials, and hit as first-class contracts |
| Qt Widgets / Quick | Stacking, masks, partial event transparency | Same *class* of composition, WebView-first, not Qt at runtime |
| Sibling Rust Vela (wgpu, repo `../Vela`) | Retained native + GPU viewports | **Different product** - no WebView core; do not confuse with this monorepo |

References: [Qt composition notes](docs/research/qt-composition-notes.md) · [Tauri comparison](docs/research/tauri-comparison.md) (process/IPC/security, not a runtime).

## Monorepo

```text
New_Vela/
  docs/               Architecture, domain guides, ADRs, research, writing guidelines
  packages/api/       @vela/api - shared contracts (usable today)
  packages/shell-core @vela/shell-core - portable Shell policy + hit/layer state (tests on Linux)
  hosts/desktop-shell Phase 1 macOS Shell scaffold (Swift on macOS; README only until Xcode)
  apps/playground     Dogfood web content (mock window.vela in browser)
  example/clock       Minimal clock App TS sample (layers + hit + mock bridge)
  plugins/            (planned) camera, materials, …
```

## Quick start

Requires [Bun](https://bun.sh).

```bash
cd /path/to/New_Vela
bun install
bun test
bun run typecheck
bun run playground:serve   # layout review with mock window.vela
bun run example:clock      # minimal clock sample (http://localhost:5174)
```

## Core ideas

| Concept | Role |
|---------|------|
| `Layer` | Composition unit: webview / native / material / chrome / passthrough |
| `HitPolicy` | In-app regional hit-through between layers |
| `WindowInputMode` | Window to OS click-through (annotator-style) |
| `MaterialId` | `apple.liquidGlass`, `win.mica`, … with platform fallback |
| `defineNativeComponent` | Register UI-bearing native plugins |
| `Capability` | Permission gate for system APIs |

## Documentation

Full index and reading order: **[docs/README.md](docs/README.md)**.  
Style (mandatory): **[docs/writing-guidelines.md](docs/writing-guidelines.md)**.

| Doc | Purpose |
|-----|---------|
| [Architecture](docs/architecture.md) | Split, principles, security spine |
| [Composition and layers](docs/composition-and-layers.md) | Layer kinds, stack, insert/update |
| [Input and hit testing](docs/input-and-hit-testing.md) | Two-level input model |
| [Materials](docs/materials.md) | System materials and fallbacks |
| [Capabilities and plugins](docs/capabilities-and-plugins.md) | Permissions, native components, bridge |
| [API contracts](docs/api-contracts.md) | `@vela/api` module map |
| [Technology stack](docs/technology-stack.md) | Host/runtime choices |
| [Platform support](docs/platform-support.md) | Tiers and feature matrix |
| [Roadmap](docs/roadmap.md) | Phased delivery |
| [Testing and acceptance](docs/testing-and-acceptance.md) | Host smoke gates |
| [macOS spike architecture](docs/macos-spike-architecture.md) | Phase 1 Shell/hit plan |
| [Design gaps](docs/design-gaps.md) | Prioritized design debt |
| [Qt composition notes](docs/research/qt-composition-notes.md) | Qt Widgets/Quick to Vela map (research) |
| [Tauri comparison](docs/research/tauri-comparison.md) | Tauri 2 process/IPC/security reference (research) |
| [Cross-platform abstraction](docs/cross-platform-abstraction.md) | Contracts-first multi-backend Shell |
| [ADR index](docs/adr/README.md) | Decision records |

ADRs: [0001 - Composition, hit, materials](docs/adr/0001-composition-hit-material.md) (Accepted) · [0002 - IPC / privilege](docs/adr/0002-ipc-privilege.md) (Proposed) · [0004 - Cross-platform Shell abstraction](docs/adr/0004-cross-platform-abstraction.md) (Accepted) · [0005 - Zig interop](docs/adr/0005-zig-interop-layer.md) (Accepted) · [0006 - TS-first capabilities](docs/adr/0006-ts-first-capabilities.md) (Accepted) · [0007 - TS full stack / pluggable Host](docs/adr/0007-typescript-full-stack-host.md) (Accepted) · [0008 - Zig systems surface](docs/adr/0008-zig-systems-surface.md) (Accepted).

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
2. ~~Contract hardening: `resolveHit`, RPC types, coords, web-shaped defaults, snapshot~~
3. macOS spike (in progress): `@vela/shell-core` policy/tests + shell scaffold; next real Swift Shell + Liquid Glass + S1–S7 - [spike architecture](docs/macos-spike-architecture.md)
4. Desktop privileged Host (Bun reference) + typed RPC / preload bridge - [ADR 0002](docs/adr/0002-ipc-privilege.md)
5. Capability plugins (fs, dialog, clipboard, notify)
6. Windows parity → mobile hosts (same contracts)

Full plan: [docs/roadmap.md](docs/roadmap.md). Design debt: [docs/design-gaps.md](docs/design-gaps.md).

## License

TBD
