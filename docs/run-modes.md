# Run modes: instant and static

> **Type**: Conceptual  
> **Status**: Current  
> **Audience**: App authors | Host implementers | Maintainers  
> **SoT**: [ADR 0007](adr/0007-typescript-full-stack-host.md) (App vs Host, Bun role); this page for assembly and packaging modes

Vela has **two product run modes**: **instant** (dev feedback) and **static**
(pre-release verification and release packages). Modes differ in **how the app
is assembled and where runtimes sit**. They must **not** fork `@vela/api`,
`window.vela`, or the privilege model.

## Summary

| Mode | Goal | Bun at runtime? | Where App JS runs |
|------|------|-----------------|-------------------|
| **Instant** | Fast edit → see | Allowed as **desktop reference Host** + toolchain | System WebView (dev server or live load) |
| **Static** | Reproducible ship-shaped artifact | **No** — Bun is **compile/bundle only** | System WebView **only** (packaged assets) |

**Rule:** App TypeScript is always a **WebView page** (least privilege). Bun is
never the engine that executes App UI in a shipping package. iOS and Android
packages **must not** require Bun; static mode is the packaging shape those
stores already force, used on every OS so release validation matches reality.

## Why two modes

| Pressure | Instant | Static |
|----------|---------|--------|
| Author velocity | Source load, HMR, optional Bun Host process | Secondary |
| Ship parity (desktop ↔ mobile) | May use desktop-only Host shortcuts | **Required** — same App path as iOS |
| Reproducible CI / release | Optional | **Required** |
| Capability profile | May use `development` grants for dogfood | Prefer `production` (manifest-only grants) |

CLI shape:

```text
cd example/clock && bun run dev  # preferred: independent package root
bun run dev                      # monorepo shortcut → --dir example/clock
bun run dev:pick                 # monorepo discover / menu
bun run vela -- dev [options]    # same CLI; see tools/cli
bun run vela -- dev --dir <path> # any package root (vela.json)
bun run vela -- dev --list       # print monorepo packages
bun run vela -- dev --browser    # content only (browser mock window.vela)
bun run vela -- dev --url <url>  # Shell only; content already served elsewhere
vela build                       # (planned) static: bundle App + Shell/Host
vela run --release               # (planned) run the static tree
```

**Shipped today:** `tools/cli` `dev` orchestrates App serve + `hosts/linux-shell`
(auto `zig build` when the binary is missing). Packages follow the **App package
layout** ([app-package-layout.md](app-package-layout.md)). **Preferred dogfood**
is an independent package root (nearest `vela.json` from cwd, or `--dir`) —
`example/clock` is the in-repo stand-in for external apps. Monorepo multi-package
discovery (`vela.workspace.json`) is secondary (`dev:pick` / `--app` / `--list`).
Content-only: `bun run playground:serve` / `example:clock`.

## Shared invariants (both modes)

1. **Same contracts** — `@vela/api`, preload channels (`call` / `layers` /
   `hit` / `events`), deny/reject shapes.
2. **Same trust boundary** — page never gets Node, FFI, or secrets; privileged
   work stays behind the bridge ([ADR 0002](adr/0002-ipc-privilege.md)).
3. **App JS always in the system WebView** — not in Bun, not in a second
   Chromium. Instant may load from `http://localhost`; static uses packaged
   schemes (`app://` / `asset://` when packaging lands).
4. **Shell stays native** — hit, materials, windowing, WebView embed
   ([ADR 0001](adr/0001-composition-hit-material.md), [ADR 0004](adr/0004-cross-platform-abstraction.md)).
5. **Host plugins are source-portable** when a Host TS backend exists; engine is
   pluggable ([ADR 0007](adr/0007-typescript-full-stack-host.md) D4–D5).

Modes change **assembly**, not **semantics**.

## Instant mode (dev)

### Intent

Minimize the loop from edit to a running window (or browser mock). Prefer
seconds of feedback over bit-identical ship trees.

### Assembly

| Piece | Instant behavior |
|-------|------------------|
| App TS / CSS / assets | Dev server or unbundled ESM; HMR when available |
| Bun | **Toolchain** (`bun test`, install, typecheck) **and** optional **desktop reference Host** process for plugins / lifecycle |
| Shell / Zig | Debug or mock L4; `linux-shell` / `desktop-shell` spikes OK |
| Capability profile | `development` allowed for dogfood; still structured deny |
| Content URL | Localhost or file is acceptable for spikes |

### Sub-variants (not separate product modes)

| Sub-variant | Use |
|-------------|-----|
| **Browser mock** | Layout / contracts without real Shell (`apps/playground` mock `window.vela`) |
| **Real Shell + mock Host** | Composition spike (Phase 1 single process) |
| **Real Shell + Bun Host** | Desktop end-to-end while iterating plugins |

### What instant must not do

- Invent a different `window.vela` surface than production.
- Run App business UI inside the Bun process as if it were the WebView.
- Disable capability checks entirely without an explicit dogfood-only flag
  documented as non-shipping.

## Static mode (pre-release and release)

### Intent

Build a **ship-shaped** tree: fixed assets, compiled natives, production
profile. Use it for release **and** for “does this still work when we package
like the store?” validation — especially **iOS/Android**, which cannot ship Bun.

### Assembly

| Piece | Static behavior |
|-------|-----------------|
| App TS | **Compiled/bundled** on a build machine (Bun as bundler/toolchain) into a content root |
| App runtime | **System WebView only** loads that content root |
| Bun on device / in app package | **Forbidden as a product requirement** — not shipped for App execution; not required on iOS/Android |
| Privileged Host | Ship-shaped backend: native methods and/or Host TS on a **platform-acceptable** runtime (e.g. system JSC on iOS). Desktop may ship a Host binary; it is **not** “App JS runs in Bun.” |
| Shell / Zig | Release-oriented compile (`ReleaseSafe` / equivalent) into the install tree |
| Capability profile | `production`: manifest grants only; unsigned native load blocked by default |
| Content URL | Custom scheme / packaged assets — not open localhost as default |

### Bun’s only job in static mode

On **CI and developer machines**:

- Install workspace deps
- Typecheck / unit tests
- **Bundle App web assets** into the package
- Optionally bundle or check Host plugin **source** for a target Host ABI

On **the user’s device / shipped package**:

- Bun is **not** required
- App JS does **not** execute under Bun

This matches mobile packaging and keeps desktop release validation honest: if
static works only when a Bun process serves the page, the build is wrong.

### Desktop static vs mobile static

| Concern | Desktop static | Mobile static |
|---------|----------------|---------------|
| App JS | WebView + packaged assets | Same |
| Bun in package | **Not required** for App path; avoid treating “must ship Bun” as default | **Must not** ship Bun for App Store / Play norms |
| Host TS plugins | Prefer same plugin source on a desktop Host backend (may be a dedicated Host process — implementation choice) | Pluggable backend or interim native `call` parity ([ADR 0007](adr/0007-typescript-full-stack-host.md) D4) |
| Zig interop | May be in-process or side process with Shell | Optional; not required for mobile v1 |

**Product promise:** one App package story — **WebView runs App JS** — on every
OS. Host privilege is a separate runtime, never the App UI engine.

## Orthogonal axes (do not fold into “mode”)

| Axis | Values | Notes |
|------|--------|-------|
| **Capability profile** | `development` \| `production` | Instant often uses development; static should use production for release gates |
| **Optimize level** | debug \| release natives | Static can still be debug-instrumented for dogfood |
| **Host backend** | Bun reference \| JSC \| native shim \| … | Pluggable; static prefers the **ship** backend for that OS |
| **Content source** | mock in-page \| dev server \| packaged | Instant may mock; static must package |

## Mapping to current repo

| Today | Mode affinity |
|-------|----------------|
| `bun test` / `bun run typecheck` | Toolchain (both) |
| `bun run playground:serve`, `example:clock` | Instant (browser mock) |
| `hosts/linux-shell` + local URL | Instant / composition spike |
| `zig build` release artifacts + fixed asset tree | Static-shaped (target) |
| Full `vela build` / signed packages | Static (planned Phase 2+) |

## Acceptance implications

Static mode is the right default for:

- Release packaging gates
- “Unsigned load blocked in production profile”
- Cross-platform dogfood: **same bundled App content** on macOS, Linux, iOS,
  Android with only materials/capabilities degrading

Instant mode is the right default for:

- Contract iteration in `@vela/api` / `shell-core` / `host-core`
- Layout review with mock bridge
- Desktop Host plugin authoring with Bun as reference runtime

Acceptance scenarios in [testing-and-acceptance.md](testing-and-acceptance.md)
should eventually run against **static** trees for ship confidence, with a
smaller instant smoke for developer UX.

## App load (WebView, not Bun)

Static mode answers **where** App JS runs. **How fast** the first window feels is a separate model: process/WebView create, bridge inject, and asset compile — improved with **Shell prewarm**, **code/bytecode cache-friendly packaging**, and optional **shell first-paint** HTML. Do not ship Bun into the client to fix App cold start.

Full cost layers, snapshot vocabulary, Cloudflare-class parallels, and host checklist:
[App load and startup](app-load-and-startup.md).

## Related

- [Architecture](architecture.md): process split and principles
- [App load and startup](app-load-and-startup.md): WebView cold start; prewarm and cache (no Bun on device)
- [ADR 0007](adr/0007-typescript-full-stack-host.md): App vs Host TS, Bun toolchain vs runtime
- [Technology stack](technology-stack.md): runtime choices
- [Cross-platform abstraction](cross-platform-abstraction.md): L0–L4 map
- [Platform support](platform-support.md): tiers; no Bun-on-device for mobile App path
- [Roadmap](roadmap.md): packaging and production profile milestones
