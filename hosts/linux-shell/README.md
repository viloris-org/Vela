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
    main.zig                  # CLI + process entry + session log
    preload.js                # copy embedded via @embedFile (keep in sync with scripts/)
    geometry.zig              # logical geometry (mirror @vela/api)
    layers.zig                # layer tree + web-shaped store
    hit.zig                   # resolveHit mirror + lastHit format
    materials.zig             # gtk.blur policy + paint honesty
    session.zig               # Wayland global → ShellSessionFeature map + paint plan
    bridge.zig                # window.vela JSON handlers
    c/vela_gtk.h|c            # thin GTK4/WebKitGTK surface
    c/vela_session.h|c        # GDK backend + Wayland registry probe
```

## Dogfood layer ids

| Id | Role |
|----|------|
| `underlay-native` | Native underlay (z 5) |
| `main-webview` | Primary WebView (z 10, web-shaped) |
| `toolbar-material` | Capsule material toolbar (z 30) |

## Materials honesty

Paint path is chosen by `session.planGtkBlurPaint` after a display probe:

| Planned path | When |
|--------------|------|
| `compositor-window-blur` | Wayland advertises `ext_background_effect_manager_v1` or KDE blur |
| `snapshot-blur` | Host implements snapshot (feature flag) |
| `translucent-chrome` | Default when no backdrop path |

Until compositor blur is **applied** to the surface, the widget still paints translucent chrome. Logs report `path=` and `degraded` honestly. Protocol names stay in L4; portable ids are `material.backdrop.window-behind` etc. See [linux-spike-architecture.md](../../docs/linux-spike-architecture.md) and [materials.md](../../docs/materials.md).

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
- [x] Session probe + Wayland feature map (`ext-background-effect` → window-behind)
- [ ] Apply background-effect blur region to material host
- [ ] Manual L1–L6 with playground on display session
- [ ] Optional: export C ABI for `hosts/zig-shell`

## References

- [linux-spike-architecture.md](../../docs/linux-spike-architecture.md)
- [macos-spike-architecture.md](../../docs/macos-spike-architecture.md)
- [ADR 0001](../../docs/adr/0001-composition-hit-material.md) · [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md)
- `packages/shell-core` · `apps/playground`
