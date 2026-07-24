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
- **Bun** is the **repo toolchain** and **desktop instant-mode reference Host** — not a performance requirement; **static/release** uses Bun for compile/bundle only; App JS always runs in the system WebView (no Bun required in mobile packages)

## Positioning

| System | Model | Vela’s angle |
|--------|--------|----------------|
| Electron | Chromium + Node | Lighter system WebView + privileged Host TS; stronger multi-layer native composition |
| Flutter desktop | Often whole-window mouse ignore | Regional holes between Web / native / material |
| Tauri 2 | WebView + Core + commands/capabilities | Same security class; layers, materials, and hit as first-class contracts |
| Qt Widgets / Quick | Stacking, masks, partial event transparency | Same *class* of composition, WebView-first, not Qt at runtime |
| Legacy Rust Vela (`Vela_old`, wgpu) | Retained native + GPU viewports | Archived predecessor — different stack; do not confuse with this monorepo |

References: [Qt composition notes](docs/research/qt-composition-notes.md) · [Tauri comparison](docs/research/tauri-comparison.md) (process/IPC/security, not a runtime).

## Monorepo

```text
Vela/
  docs/               Architecture, domain guides, ADRs, research, writing guidelines
  packages/api/       @vela/api - shared contracts (usable today)
  packages/shell-core @vela/shell-core - portable Shell policy + hit/layer state (tests on Linux)
  packages/host-core  @vela/host-core - portable Host call router + capability enforce
  hosts/zig-shell     Desktop Zig interop (L2.5): C ABI + mock L4 + RPC codec skeleton
  hosts/desktop-shell Phase 1 macOS Shell scaffold (Swift on macOS; README only until Xcode)
  hosts/linux-shell  Linux composition spike (GTK4 + WebKitGTK 6.0; Tier 2)
  apps/playground     Dogfood web content (mock window.vela in browser)
  example/clock       Minimal clock App TS sample (layers + hit + mock bridge)
  templates/          App scaffold copy sources (not auto-discovered demos)
  skills/             Agent skills for building apps with Vela (install via npx skills; not monorepo maintenance)
  tools/cli           Developer CLI (`bun run dev` — content + Shell)
  plugins/            notify, tray, dialog, clipboard, fs (Host TS + mock sys)
  packages/sys-desktop Desktop Host systems facades (notify, tray, dialog, clipboard, fs)
```

## Installation

### What you need

Bun is the **repo toolchain** and desktop instant-mode reference Host. It is not required inside shipping App packages. See [run modes](docs/run-modes.md) and [platform support](docs/platform-support.md).

| Goal | Linux | macOS | Windows |
|------|-------|-------|---------|
| Contracts, packages, plugins, unit tests | Bun | Bun | Bun |
| Content-only dogfood (browser mock `window.vela`) | Bun | Bun | Bun |
| Zig interop skeleton (`hosts/zig-shell`) | Zig **0.16.x** | Zig **0.16.x** | Zig **0.16.x** (best-effort) |
| Native Shell dogfood | `hosts/linux-shell`: Zig + GTK4 + WebKitGTK 6.0 | `hosts/desktop-shell`: **scaffold only** (Xcode; no compilable app yet) | **Not shipped** (Phase 4; WebView2 planned) |
| Host systems facades (`@vela/sys-desktop` notify/tray/dialog) | `notify-send`, Python3 + AppIndicator (tray), `zenity`/`kdialog` | Xcode CLI tools (`swift`), GUI login session | PowerShell (WinRT toast / WinForms); standard desktop |

**Honest status today:** `bun run dev` launches the **Linux** Shell. On macOS and Windows you can develop contracts, run tests, and dogfood App content in a normal browser; a native composition window is not available yet.

### 1. Install Bun

**Linux / macOS:**

```bash
curl -fsSL https://bun.sh/install | bash
# restart the shell or source your profile so `bun` is on PATH
bun --version
```

Homebrew also works: `brew install oven-sh/bun/bun`.

**Windows (PowerShell):**

```powershell
# Official installer — see https://bun.sh for the current one-liner
irm bun.sh/install.ps1 | iex
bun --version
```

winget / scoop / chocolatey also work if they ship a current Bun. Prefer a native Windows terminal (PowerShell or Windows Terminal), not a broken PATH from mixed shells.

### 2. Install Zig 0.16.x (optional — native Shell / interop)

Needed for `hosts/zig-shell` and for the Linux Shell. **Zig 0.16.x** only (`zig version` must print `0.16.x`). Other majors are not supported yet.

```bash
# Official tarball — pick OS/arch from https://ziglang.org/download/
# Extract and put the `zig` binary on PATH

# Or pin with a version manager (zigup / asdf / mise / scoop on Windows)
zig version   # expect 0.16.x
```

| Platform | Notes |
|----------|--------|
| Linux / macOS | Primary targets for `hosts/zig-shell` |
| Windows | Best-effort; no Windows Shell tree yet, but the interop skeleton may still build |

### 3. Platform packages

#### Linux (for `hosts/linux-shell`)

Install **GTK4** and **WebKitGTK 6.0** development packages, then confirm `pkg-config` finds them:

```bash
# Fedora / RHEL-like
sudo dnf install gtk4-devel webkitgtk6.0-devel pkgconf-pkg-config

# Debian / Ubuntu (names may vary slightly by release)
sudo apt update
sudo apt install libgtk-4-dev libwebkitgtk-6.0-dev pkg-config

# Arch
sudo pacman -S gtk4 webkitgtk-6.0 pkgconf

pkg-config --modversion gtk4 webkitgtk-6.0
```

If `pkg-config` cannot find `webkitgtk-6.0`, your distro may not ship WebKitGTK 6 yet — upgrade the base system or build from source. Older WebKit2GTK 4.1 is **not** a substitute. Details: [hosts/linux-shell/README.md](hosts/linux-shell/README.md).

Optional Host systems tools (notify / tray / dialog helpers in `@vela/sys-desktop`):

```bash
# Fedora example — adjust names per distro
sudo dnf install libnotify python3-gobject libappindicator-gtk3 zenity
```

#### macOS

| Piece | Install | Status |
|-------|---------|--------|
| Bun | Step 1 above | Required for this monorepo |
| Zig 0.16.x | Step 2 above | Optional; for `hosts/zig-shell` |
| Xcode or Command Line Tools | App Store **Xcode**, or `xcode-select --install` | Needed for `swift` tray helper and for the future Shell |
| macOS Shell (`hosts/desktop-shell`) | — | **Scaffold only** — no compilable Swift app is checked in yet. See [hosts/desktop-shell/README.md](hosts/desktop-shell/README.md) and [macOS spike architecture](docs/macos-spike-architecture.md) |

```bash
# CLI tools (enough for swift helpers / zig)
xcode-select --install

# Full Xcode (needed once a real macOS app target lands under hosts/desktop-shell)
# Install from the App Store, then:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
swift --version
```

What works on macOS **today**:

```bash
bun install
bun test
bun run typecheck
bun run playground:serve    # browser mock
bun run example:clock
bun run vela -- dev --browser
cd hosts/zig-shell && zig build && zig build test   # if Zig is installed
```

What does **not** work yet: `bun run dev` native window (that path targets `hosts/linux-shell`), and building `hosts/desktop-shell` as an app.

#### Windows

| Piece | Install | Status |
|-------|---------|--------|
| Bun | Step 1 (PowerShell installer) | Required for this monorepo |
| Git | [git-scm.com](https://git-scm.com/) or `winget install Git.Git` | Clone / line endings |
| Zig 0.16.x | Step 2 above | Optional; interop skeleton best-effort |
| PowerShell 5+ / 7 | Ships with Windows; PowerShell 7 recommended | `@vela/sys-desktop` notify / tray / dialog helpers |
| Windows Shell (WebView2 + composition) | — | **Not in tree** — planned Phase 4 ([platform support](docs/platform-support.md), [roadmap](docs/roadmap.md)) |
| WebView2 Runtime | Evergreen runtime (most Win10/11 already have it) | Required only when a Windows Shell ships |

```powershell
# Example with winget (optional)
winget install Git.Git
# Bun: use https://bun.sh installer, then:
bun --version
```

What works on Windows **today**:

```powershell
bun install
bun test
bun run typecheck
bun run playground:serve
bun run example:clock
bun run vela -- dev --browser
# optional: hosts\zig-shell  →  zig build ; zig build test
```

What does **not** work yet: a native Vela window, `bun run dev` Shell orchestration (Linux-only today), and WebView2 composition host.

### 4. Clone and install workspace dependencies

```bash
git clone <repo-url> Vela
cd Vela
bun install
```

`bun install` resolves the Bun workspaces (`packages/*`, `apps/*`, `example/*`, `plugins/*`). No separate per-package install is required for the monorepo layout.

### 5. Verify the install

```bash
bun test
bun run typecheck
```

Optional native checks:

```bash
# Zig interop skeleton (no toolkit)
cd hosts/zig-shell && zig build && zig build test && cd ../..

# Linux Shell only — needs GTK4 + WebKitGTK 6.0
cd hosts/linux-shell && zig build && zig build test
./zig-out/bin/vela-linux-shell --self-test
cd ../..
```

### 6. Coding agents (build apps with Vela)

Skills under `skills/` teach agents how to **scaffold and author apps**, not how to
maintain this monorepo. Install with the [skills CLI](https://github.com/vercel-labs/skills):

```bash
# global (any project) — from GitHub after skills are on main
npx skills add -g -y viloris-org/Vela

# from this clone (works immediately)
npx skills add -g -y .

# list / verify
npx skills add -l .
npx skills list -g
```

Scaffold still needs a Vela checkout for `templates/minimal`. Full install notes:
[skills/README.md](skills/README.md).

## Quick start

After [Installation](#installation):

```bash
cd /path/to/Vela

# Content-only — works on Linux, macOS, and Windows (browser mock window.vela)
bun run vela -- dev --browser
bun run playground:serve   # :5173
bun run example:clock      # :5174

# One-terminal native dogfood — Linux only today
bun run dev                       # clock on :5174 + vela-linux-shell
bun run vela -- dev --app playground

# Zig interop skeleton (any platform with Zig 0.16.x)
cd hosts/zig-shell && zig build && zig build test

# Manual two-terminal path (Linux; same as `bun run dev` under the hood)
# terminal 1: bun run example:clock
# terminal 2: cd hosts/linux-shell && zig build && zig build run -- --url http://127.0.0.1:5174
```

On Linux, `bun run dev` starts the content server, waits until it is ready, builds `hosts/linux-shell` if the binary is missing, then launches the native window. On macOS / Windows, use the browser paths above until those Shells land. See [run modes](docs/run-modes.md).

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
| [Run modes](docs/run-modes.md) | Instant (dev) vs static (release; Bun compile-only, App JS in WebView) |
| [App load and startup](docs/app-load-and-startup.md) | WebView cold start: prewarm, code cache, shell snapshot (no Bun on device) |
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
| [Linux spike architecture](docs/linux-spike-architecture.md) | Parallel Linux Tier 2 spike |
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
3b. Linux composition spike (this machine): GTK4 + WebKitGTK 6.0 under `hosts/linux-shell`; L1–L6 - [linux spike](docs/linux-spike-architecture.md)
4. Host capability contracts (in progress): `@vela/host-core` + `checkCapability` / `parseAppManifest`; next Bun process + typed RPC / preload bridge - [ADR 0002](docs/adr/0002-ipc-privilege.md)
5. Capability plugins (notify, tray, dialog, clipboard, fs, shell + material/camera insert gates; playground allow/deny for core set; tray/dialog UI next)
6. Windows parity → mobile hosts (same contracts)

Full plan: [docs/roadmap.md](docs/roadmap.md). Design debt: [docs/design-gaps.md](docs/design-gaps.md).

## License

TBD
