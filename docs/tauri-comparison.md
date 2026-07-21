# Tauri as a reference (not a runtime)

This document records what **Vela** deliberately borrows from
[Tauri 2](https://v2.tauri.app/) architecture and security docs, and where Vela
**diverges**. Tauri is a production WebView shell with a Rust core; Vela is a
Bun-orchestrated, **composition-first** shell. We do not embed Tauri at runtime.

> Primary sources (Tauri 2): [Architecture](https://v2.tauri.app/concept/architecture/),
> [Process model](https://v2.tauri.app/concept/process-model/),
> [IPC](https://v2.tauri.app/concept/inter-process-communication/),
> [Security](https://v2.tauri.app/security/),
> [Capabilities](https://v2.tauri.app/security/capabilities/),
> [Permissions](https://v2.tauri.app/security/permissions/),
> [Plugins](https://v2.tauri.app/develop/plugins/).

Qt-class composition remains documented in
[Qt composition notes](qt-composition-notes.md). Use **both** references:

| Reference | What we take |
|-----------|----------------|
| **Qt** | Layer stack, masks, partial mouse transparency, foreign surfaces |
| **Tauri** | Process isolation mindset, IPC primitives, capability/permission model, plugin packaging shape, system WebView choice |

## Shared product class

| Concern | Tauri | Vela |
|---------|-------|------|
| Main UI | HTML/CSS/JS in system WebView | Same |
| System WebView | WebView2 / WKWebView / webkitgtk | Same intent |
| Not Electron | No bundled Chromium+Node app runtime | Same |
| Frontend freedom | Any web stack | Same |
| Privilege | Core privileged; WebView least privilege | Same spine |
| Extensions | Plugins + permissions | Capability plugins + native components |

## Process model

### Tauri (summary)

- **Core process**: sole OS-privileged entry; windowing, tray, notifications,
  global state; **all IPC routes through Core** so messages can be filtered.
- **WebView process(es)**: OS WebView runs untrusted UI; no full OS access.
- Motivation: least privilege, crash isolation, multi-core (see Tauri process
  model docs).

### Vela mapping

Vela has **three** privilege tiers on desktop (mobile folds Bun into the native
host):

```text
┌─────────────────────────────────────────────────────────────┐
│ WebView content (untrusted)                                 │
│   only window.vela — call / layers / hit / events           │
└───────────────────────────┬─────────────────────────────────┘
                            │ preload bridge (message pass)
┌───────────────────────────▼─────────────────────────────────┐
│ Bun host (desktop orchestration)                            │
│   lifecycle, capability enforcement, plugins, packaging     │
└───────────────────────────┬─────────────────────────────────┘
                            │ typed RPC (ADR 0002)
┌───────────────────────────▼─────────────────────────────────┐
│ Native Shell (window / WebView embed / layer tree / hit)    │
│   materials, signed native factories, platform backends     │
└─────────────────────────────────────────────────────────────┘
```

| Tauri idea | Vela analogue |
|------------|----------------|
| Core process | **Native Shell** + **Bun host** together (split roles) |
| WebView process | System WebView process(es) |
| IPC hub | Bun host for `call` / capability; Shell for layers / hit / paint |
| No secrets in frontend | Same: business secrets and privileged I/O stay off the page |

**Why split Bun and Shell?** Composition (layers, hit router, Liquid Glass /
Mica) is hard to own from a pure JS host. Bun owns app/plugin lifecycle and
capability catalog; Shell owns drawing and input. Both **must** re-check
permissions (defense in depth), same spirit as Tauri Core filtering every IPC.

## IPC primitives

### Tauri

| Primitive | Shape | Use |
|-----------|--------|-----|
| **Commands** | `invoke` request/response (JSON-RPC-like) | Call privileged APIs |
| **Events** | Fire-and-forget, either direction | Lifecycle / state |
| Patterns | Brownfield vs Isolation (sandboxed interceptor) | Hardening |

Message passing is preferred over shared memory / raw FFI so the privileged side
can **reject** malicious traffic.

### Vela (`window.vela`)

| Surface | Tauri analogue | Notes |
|---------|----------------|-------|
| `vela.call(method, args)` | Commands / `invoke` | Capability-gated; serializable args only |
| `vela.events.subscribe` | Events | Host → web and web → host lifecycle |
| `vela.layers.*` | (no direct Tauri peer) | First-class composition control |
| `vela.hit.*` | (no direct Tauri peer) | Web-shaped hit regions |

Rules (aligned with Tauri IPC safety):

1. **Async message passing only** between WebView and host — never Node
   integration, never raw FFI from page JS.
2. Args/results must be **structured-clone / JSON-serializable** for `call`.
3. Recipient may **deny** (missing capability, bad scope, unsigned module).
4. Isolation-style interception (optional hardening layer between page and
   privilege) is **future** — record under ADR 0002 if adopted.

Detailed bridge: [Capabilities and plugins](capabilities-and-plugins.md).
IPC transport (Bun ↔ Shell): planned **ADR 0002**.

## Security model

### Tauri building blocks

| Concept | Role |
|---------|------|
| **Permission** | Privilege to run specific commands; optional scopes |
| **Capability** | Grant set bound to windows/webviews (and platforms) |
| **Scope** | Fine-grained resource limits (paths, URLs, …) |
| **Runtime Authority** | Enforce grants at invoke time |
| **CSP / asset protocol** | Contain WebView attack surface |
| **Trust boundary** | Core (full OS) vs WebView (IPC only) |

Default posture: least privilege; system WebView (not bundled Chromium) so OS
updates patch the renderer faster on average.

### Vela mapping

| Tauri | Vela (`@vela/api`) |
|-------|---------------------|
| Permission id | `PermissionId` / `BuiltinPermissions` |
| Permission definition | `CapabilityDefinition` (catalog entry) |
| Capability file / grant | `CapabilityGrant` + `AppManifestCapabilities` profiles |
| Window/webview target | Preload **profile** per window/WebView |
| Scope | `CapabilityGrant` scopes (`path`, `url`, …) |
| Runtime Authority | Bun host **and** Shell enforce on `call` / sensitive insert |
| Asset protocol | Production `app://` / `asset://` (no open localhost by default) |
| Plugin permissions | Plugin-registered ids via `defineCapability` |

Extra Vela surface (beyond typical Tauri command gates):

- **Sensitive layers** (camera, materials, unsigned native) require matching
  permissions at **insert** time, not only at `call` time.
- **Signed native modules** — Shell loads factories; page never `dlopen`s.

## Plugins

### Tauri plugin shape

- Cargo crate + optional JS/TS API package.
- Optional Android (Kotlin) / iOS (Swift) packages.
- Ships **permission files** consumed by the capability system.
- Hooks lifecycle; exposes commands/events.

### Vela plugin types (planned)

| Type | Surface | Tauri parallel |
|------|---------|----------------|
| Capability plugin | Methods behind `vela.call` + permission ids | Command plugin + permissions |
| Native UI plugin | `defineNativeComponent` + signed module | Mobile native plugin + UI surface |
| Material backend | Platform paint for `MaterialId` | (no direct peer — composition-specific) |

Naming/layout guidance when packages appear:

- Prefer explicit ids (`fs:app-read`, `camera:preview`) over ambient globals.
- Ship a **default** permission set and narrower allow sets (Tauri
  `:default` / `allow-*` style).
- Document risk level in the capability catalog (Vela already models risk).

ABI and signing: **ADR 0003**.

## Multi-window / multi-WebView

Tauri: Core manages many windows/WebViews; capabilities can target labels
(`windows: ["main"]`) and platforms.

Vela intent:

- Each window has its own **layer tree** (ADR 0001).
- Each WebView layer may use a different **capability profile**.
- Multi-WebView is a first-class layer kind, not a side path — see
  [Composition and layers](composition-and-layers.md).

## Packaging and assets

| Topic | Tauri | Vela intent |
|-------|-------|-------------|
| Config | `tauri.conf.json` (+ platform overlays) | App manifest + host packaging hooks (Phase 2) |
| Frontend dist | Build embeds / serves assets | Bun builds web assets; Shell serves custom schemes |
| Sidecar | External binaries | Possible later for heavy helpers; not required for v1 |
| Updater | Official plugin | Out of scope until hosts stabilize |
| Bundle size | System WebView keeps binary small | Same goal |

## What we deliberately do **not** copy

1. **Rust-only Core as the only host language** — desktop orchestration is
   **Bun**; Shell language is open (Swift / Win / TBD).
2. **Command-only product surface** — Vela’s differentiator is **layers,
   materials, regional hit**, not a thinner Tauri clone.
3. **WRY/TAO as mandatory window stack** — Shell may use platform-native
   toolkits; abstraction is contracts, not a single crate.
4. **Assuming single content WebView per window** — multi-layer composition is
   the core ADR.
5. **Replacing Qt mapping** — hit/mask philosophy still comes from Qt-class
   APIs, not Tauri.

## Checklist for authors

When extending Vela docs or hosts, ask:

- [ ] Is the WebView still least-privilege (whitelist bridge only)?
- [ ] Is every privileged path gated by a named permission + profile?
- [ ] Can Shell reject a request even if Bun misconfigured (defense in depth)?
- [ ] Are composition/hit rules documented as layers, not as ad-hoc OS hacks?
- [ ] Did we avoid implying Vela embeds Tauri or Electron?

## Related

- [Architecture](architecture.md) — process split and security spine  
- [Capabilities and plugins](capabilities-and-plugins.md) — grants and bridge  
- [Technology stack](technology-stack.md) — stack choices  
- [Qt composition notes](qt-composition-notes.md) — composition reference  
- [ADR 0001](adr/0001-composition-hit-material.md) — composition decisions  
- Planned: ADR 0002 (IPC), ADR 0003 (plugin ABI)
