# Testing and acceptance

> **Type**: Tracking  
> **Status**: Current  
> **Audience**: Host implementers | Maintainers  
> **SoT**: Acceptance gates for contracts and hosts

How we know contracts and (later) hosts meet the product bar. Until hosts exist, **contract tests** are the only automated gate; host checklists below are the target smoke suite for Phase 1+.

Related: [Roadmap](roadmap.md), [macOS spike architecture](macos-spike-architecture.md), [Qt composition notes](research/qt-composition-notes.md) (Qt-class criteria), [Tauri comparison](research/tauri-comparison.md) (capability/IPC security expectations), [ADR 0001](adr/0001-composition-hit-material.md), [ADR 0002](adr/0002-ipc-privilege.md).

## Layers of verification

| Layer | When | What |
|-------|------|------|
| Contract unit tests | Now | Pure helpers in `@vela/api` |
| Typecheck | Now | Workspace TypeScript |
| Host smoke (manual or automated) | Per host spike | Composition + hit + materials demos |
| Capability matrix | Phase 2+ | Allow/deny paths per permission |
| CI matrix | When hosts land | OS × WebView runtime |

## Contract package (current)

```bash
cd /path/to/New_Vela
bun install
bun test
bun run typecheck
```

Expected coverage in `packages/api` (expand as helpers grow):

- Geometry: region helpers, containment
- Materials: `resolveMaterial` degrade paths
- Layers: `defaultHitPolicyForKind`
- Capabilities / native component registries (test resets)
- Pure `resolveHit` + web-shaped generation rules ([design gaps](design-gaps.md) G-P0-1)

Portable Shell policy in `packages/shell-core` (`@vela/shell-core`):

- Layer tree CRUD + dogfood bootstrap stack
- S2 hole→underlay, S6 single `lastHit`, S7 stale generation (class scenarios, not host smoke)
- Opacity ≠ hit, material toolbar hit, region-through lite, preload bridge deny-all `call`

Contracts and shell-core **must not** depend on a running native Shell. Host smoke (S1–S7 on real AppKit) remains required for Phase 1 exit.

## Qt-class composition acceptance (host)

A host passes **Qt-class composition** when all of the following hold. These mirror the list in [Qt composition notes](research/qt-composition-notes.md).

1. **Multi-kind stack** - at least web + native + material coexist in one window.
2. **Regional in-app hit-through** - holes work inside the client area (`HitPolicy`).
3. **Window → OS click-through** - available without breaking (2) (`WindowInputMode`).
4. **Materials** - sample real content below or report `ResolvedMaterial.degraded`.
5. **Single delivery** - no double-click / double-focus on WebView + native sibling.
6. **Opacity ≠ hit** - changing visual opacity does not silently change `HitPolicy`.
7. **Native bounds** - foreign surfaces track Shell `bounds` / `zIndex`.

### Scenario checklist (Phase 1 macOS spike)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| S1 | Glass toolbar over WebView | Material paints; toolbar hits; content below samples correctly or degrades with reason |
| S2 | Web-shaped hole to underlay | Clicks on UI widgets hit web; clicks in hole pan/click underlay; not OS desktop |
| S3 | Annotator region-through | Listed regions hit desktop/other apps; remaining client area still uses layer hit rules |
| S4 | Camera / native slot | Native layer receives hits in bounds; web does not steal; permission deny blocks insert |
| S5 | Chrome drag / traffic lights | Custom chrome roles work; main web does not swallow system button hits |
| S6 | No dual delivery | Debug instrumentation: one `HitTarget` per pointer down |
| S7 | Stale web-shaped | Higher `generation` wins; stale updates rejected |

### Scenario checklist (Phase 4 Windows parity)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| W1 | WebView2 + Mica/Acrylic layer | Material effective id correct; degrade if unsupported |
| W2 | Same S2 - S6 as macOS | Behavioral parity, not pixel parity |
| W3 | Missing WebView2 runtime | Loud diagnostic; no silent blank window |

### Scenario checklist (Linux composition spike, Tier 2)

Design: [linux-spike-architecture.md](linux-spike-architecture.md). Behavioral parity with S* class scenarios; materials may degrade.

| # | Scenario | Pass criteria |
|---|----------|---------------|
| L1 | Window + WebView loads playground | Visible dogfood content; no silent blank window |
| L2 | Material toolbar host | Toolbar widget present; hits toolbar; real best-effort blur **or** explicit degrade reason |
| L3 | Web-shaped hole → underlay | Hole clicks underlay (not OS desktop); panel/HUD/toolbar remain hittable |
| L4 | Single delivery | Debug last `HitTarget`: one per pointer down |
| L5 | Opacity ≠ hit | Changing toolbar opacity does not open a hit hole |
| L6 | Stale generation | Lower `generation` web-shape updates dropped |

Stretch (not required for first spike exit): S3-class window region-through, chrome drag, native camera slot.

## Capability acceptance

From [Capabilities and plugins](capabilities-and-plugins.md):

- [ ] Missing permission → structured deny, no silent success
- [ ] Camera layer insert without grant fails
- [ ] `window:material` required for material layers
- [ ] Preload cannot access Node / `fs` / `child_process`
- [ ] Unsigned module load blocked by default

## Hit-router acceptance (detail)

From [Input and hit testing](input-and-hit-testing.md):

- [ ] Annotator-style `region-through` does not break in-app layer holes
- [ ] Web hole over map underlay works without stealing map pan outside UI
- [ ] Opaque glass toolbar receives hits; transparent margins do not (via mask)
- [ ] Chrome drag / system buttons work with custom chrome
- [ ] No double-click / double-focus on WebView + native sibling
- [ ] Stale `web-shaped` updates rejected when `generation` is used

## Suggested dogfood playground (Phase 1+)

Minimum playground content (any web stack):

1. Full-window map/video underlay (native or second surface)
2. Main WebView with floating toolbar and a large “hole” region
3. Capsule Liquid Glass / Mica toolbar (`material` layer)
4. Optional camera preview slot
5. Toggle: normal window input vs region-through annotator mode
6. Debug overlay: last `HitTarget` kind + layer id

Exit for Phase 1: short demo video covering S1 - S6.

## CI

| Job | Status | Command / check |
|-----|--------|-----------------|
| Contracts | Live (`.github/workflows/ci.yml`) | `bun install --frozen-lockfile` + `bun test` + `bun run typecheck` |
| macOS smoke | Planned (hosts) | Headless or UI harness for S1 - S2 |
| Windows smoke | Planned (hosts) | WebView2 present; W1 - W2 |
| Linux smoke | Planned (`hosts/linux-shell`) | Manual L1–L6; materials may degrade; GTK4 + WebKitGTK 6.0 |

Do not block CI on pixel-identical materials.

## Non-goals for early acceptance

- Per-pixel alpha hit-testing
- Scroll-linked native slots (Phase 7)
- Pixel-perfect material parity across OS
- Full CSS/DOM reimplementation outside WebView
