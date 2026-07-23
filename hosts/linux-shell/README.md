# hosts/linux-shell

**Phase 1L Linux composition spike** — native Shell process (Zig + thin C, GTK4 + WebKitGTK 6.0).

> **Status**: compilable host with hit policy, preload bridge, dogfood bootstrap, `gtk.blur` paint plan, and **compositor blur apply** (ext-background-effect / KDE). Manual L1–L6 still required.  
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

**One terminal (preferred):** from the monorepo root:

```bash
bun run dev                              # clock + this shell
bun run vela -- dev --app playground     # playground + this shell
bun run vela -- dev --build              # force zig rebuild
```

**Manual two-terminal path:**

```bash
cd hosts/linux-shell
zig build
zig build test
./zig-out/bin/vela-linux-shell --version
./zig-out/bin/vela-linux-shell --self-test

# Preferred dogfood — clock example (other terminal first):
#   bun run example:clock          # http://127.0.0.1:5174
zig build run
# or explicitly:
zig build run -- --url http://127.0.0.1:5174

# Playground composition HUD:
#   bun run playground:serve       # http://127.0.0.1:5173
zig build run -- --url http://127.0.0.1:5173
```

## Layout

```text
hosts/linux-shell/
  README.md
  build.zig
  protocols/                  # Wayland XML (ext-background-effect, KDE blur)
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
    c/vela_blur.h|c           # apply blur region (ext / KDE)
    c/gen/                    # wayland-scanner client stubs
```

## Dogfood layer ids

Live Shell boots **minimal** stack (underlay + webview). Apps insert material.

| Id | Role |
|----|------|
| `underlay-native` | Native underlay (z 5) |
| `main-webview` | Primary WebView (z 10, web-shaped) |
| `clock-material` | Clock card glass (z 8, under web; example/clock) |
| `toolbar-material` | Capsule material toolbar (z 30, above web; playground) |

Self-test still uses `bootstrapDogfood` (includes pre-seeded toolbar) for hit fixtures.

## Materials honesty

Paint path is chosen by `session.planGtkBlurPaint` after a display probe:

| Planned path | When |
|--------------|------|
| `compositor-window-blur` | Wayland advertises `ext_background_effect_manager_v1` or KDE blur |
| `snapshot-blur` | Host implements snapshot (feature flag) |
| `translucent-chrome` | Default when no backdrop path |

When the plan is `compositor-window-blur`, the host **applies** a blur region on the toplevel `wl_surface` for the material rect (`vela_blur.c`):

1. Prefer `ext_background_effect_manager_v1` → `set_blur_region`
2. Else `org_kde_kwin_blur_manager` → `set_region` + `commit`
3. Material host still paints translucent chrome on top (window-behind is not layers-below glass)

Logs report `path=`, `degraded`, `vela blur manager ready backend=…`, and `vela blur apply … region=…`. Protocol names stay in L4; portable ids are `material.backdrop.window-behind` etc. See [linux-spike-architecture.md](../../docs/linux-spike-architecture.md) and [materials.md](../../docs/materials.md).

**Regenerate Wayland stubs** (after protocol XML changes):

```bash
wayland-scanner client-header protocols/ext-background-effect-v1.xml src/c/gen/ext-background-effect-v1-client-protocol.h
wayland-scanner private-code protocols/ext-background-effect-v1.xml src/c/gen/ext-background-effect-v1-protocol.c
wayland-scanner client-header protocols/kde-blur.xml src/c/gen/kde-blur-client-protocol.h
wayland-scanner private-code protocols/kde-blur.xml src/c/gen/kde-blur-protocol.c
```

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
- [x] Host path for `example/clock` (bundle serve + material under web + web-shaped hit)
- [x] Apply background-effect / KDE blur region to material host (`vela_blur` + paint-path gate)
- [ ] Manual L1–L6 with playground on display session
- [ ] Optional: export C ABI for `hosts/zig-shell`
- [ ] Optional: snapshot-blur for true layers-below approximation

## References

- [linux-spike-architecture.md](../../docs/linux-spike-architecture.md)
- [macos-spike-architecture.md](../../docs/macos-spike-architecture.md)
- [ADR 0001](../../docs/adr/0001-composition-hit-material.md) · [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md)
- `packages/shell-core` · `apps/playground`
