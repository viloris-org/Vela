# hosts/linux-shell

**Phase 1L Linux composition spike** — native Shell process (Zig + thin C, GTK4 + WebKitGTK 6.0).

> **Status**: compilable host with hit policy, preload bridge, dogfood bootstrap, degraded `gtk.blur` paint path. Manual L1–L6 still required.  
> **Tier**: 2 (best-effort materials; window→OS region-through partial).  
> **Design**: [docs/linux-spike-architecture.md](../../docs/linux-spike-architecture.md).  
> **Contracts**: `@vela/api` pure helpers remain algorithm SoT; this tree **mirrors** `resolveHit`.

macOS L4 stays in `hosts/desktop-shell`. Do not overload that folder for Linux.

## Goals

1. Multi-kind layers: underlay + webview + material.
2. Shell-owned hit router: **one** `HitTarget` per pointer down.
3. `web-shaped` holes via `vela.hit` from dogfood (`apps/playground`).
4. Material toolbar: prefer `gtk.blur`; **loud degrade** when no live sample blur.
5. Preload injects `window.vela` subset (`version`, `layers`, `hit`; `call` deny-all).

## Dependencies (Fedora)

```bash
sudo dnf install gtk4-devel webkitgtk6.0-devel
pkg-config --modversion gtk4 webkitgtk-6.0
```

Requires **Zig 0.16.x**.

## Build / run

```bash
cd hosts/linux-shell
zig build
zig build test
./zig-out/bin/vela-linux-shell --version
./zig-out/bin/vela-linux-shell --self-test

# Dogfood (other terminal first):
#   bun run playground:serve
zig build run -- --url http://127.0.0.1:5173
```

## Layout

```text
hosts/linux-shell/
  README.md
  build.zig
  scripts/preload.js          # source of truth for inject script
  src/
    main.zig                  # CLI + process entry
    preload.js                # copy embedded via @embedFile (keep in sync with scripts/)
    geometry.zig              # logical geometry (mirror @vela/api)
    layers.zig                # layer tree + web-shaped store
    hit.zig                   # resolveHit mirror + lastHit format
    materials.zig             # gtk.blur policy + paint honesty
    bridge.zig                # window.vela JSON handlers
    c/vela_gtk.h|c            # thin GTK4/WebKitGTK surface
```

## Dogfood layer ids

| Id | Role |
|----|------|
| `underlay-native` | Native underlay (z 5) |
| `main-webview` | Primary WebView (z 10, web-shaped) |
| `toolbar-material` | Capsule material toolbar (z 30) |

## Materials honesty

This spike paints a **translucent GTK chrome** for the material host and records:

```text
degraded: true
reason: no-backdrop-blur: translucent host chrome (Tier 2 spike)
```

CSS `backdrop-filter` is not claimed as native `gtk.blur`. See [materials.md](../../docs/materials.md).

## Acceptance

Manual scenarios **L1–L6** in [testing-and-acceptance.md](../../docs/testing-and-acceptance.md).  
`--self-test` covers pure hit + stale generation + degrade honesty without a display.

## Non-goals

- Bun process / Zig UDS (Phase 2)
- Full `vela_shell_backend_vtable` export (later attach to zig-shell)
- Pixel glass vs Liquid Glass
- Dual-maintain GTK3 / WebKit2GTK 4.1

## Checklist

- [x] G-P2-3 baseline + architecture doc
- [x] Zig build + GTK4/WebKitGTK 6.0 link
- [x] `--self-test` hit/material fixtures
- [x] Preload embed + bridge handlers
- [x] Dogfood bootstrap ids
- [x] Degraded material host widget
- [ ] Manual L1–L6 with playground on display session
- [ ] Optional: export C ABI for `hosts/zig-shell`

## References

- [linux-spike-architecture.md](../../docs/linux-spike-architecture.md)
- [macos-spike-architecture.md](../../docs/macos-spike-architecture.md)
- [ADR 0001](../../docs/adr/0001-composition-hit-material.md) · [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md)
- `packages/shell-core` · `apps/playground`
