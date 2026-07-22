# Platform support

> **Type**: Reference  
> **Status**: Current  
> **Audience**: App authors | Host implementers  
> **SoT**: Platform tiers and feature matrix (intent until hosts ship)

Platform support must be explicit: WebView, materials, hit-testing, and capability surfaces differ enough to affect architecture and acceptance.

## Support tiers

### Tier 1 (primary development)

| Platform | WebView | Materials | Notes |
|----------|---------|-----------|--------|
| macOS (current + previous major) | WKWebView | Liquid Glass when available; else system material | First composition spike target |
| Windows 11 | WebView2 | Mica / Acrylic | First non-Apple materials target |

Tier 1 means (once hosts exist):

- Contracts package tests pass on CI
- Window opens with at least one WebView layer
- Multi-layer stack + regional hit-through demo works
- Capability deny/allow is enforceable
- Resize, DPI/scale factor, focus, close handled

### Tier 2

| Platform | Intent |
|----------|--------|
| Linux desktop | WebView + best-effort blur; shaped/click-through may be partial |
| Older Windows / macOS | Degrade materials; clear diagnostics |

Tier 2 must fail loudly when required capabilities are missing.

### Mobile (committed direction, experimental APIs)

| Platform | Host | UI |
|----------|------|-----|
| iOS | Native (Swift) | WebView + layers |
| Android | Native (Kotlin) | WebView + layers |

Bun is used for tooling/bundles, not as the full mobile in-process runtime. Shared surface: `@vela/api` Layer / Capability / bridge protocol.

### Non-targets (unless roadmap promotes them)

- WASM-in-browser as the primary “desktop” host
- Full Chromium embedding as default (Electron-class)
- Pixel-identical materials across OS

## Coordinate and DPI contract

- Layer bounds and regions use **logical** window content coordinates
- Shell converts to physical pixels at the platform boundary
- `WindowState.scaleFactor` is part of the contract
- Web-shaped regions must be expressed in the same logical space as layers

## Feature matrix (intent)

| Feature | macOS | Windows | Linux | iOS | Android |
|---------|-------|---------|-------|-----|---------|
| Multi WebView layers | yes | yes | yes | yes | yes |
| Native component layers | yes | yes | partial | yes | yes |
| System materials | Liquid Glass / material | Mica/Acrylic | gtk.blur | material | fallback/css first |
| Regional layer hit-through | yes | yes | yes | yes | yes |
| Window region-through to OS | yes | yes | partial | limited | limited |
| Capability plugins | yes | yes | yes | yes | yes |

## Abstraction expectations

All platforms implement the same **Shell role** against `@vela/api` (window,
WebView, layers, hit, materials, factories, control plane). Backends may use
different languages and toolkits; they must not fork the public contract
surface. See [Cross-platform abstraction](cross-platform-abstraction.md) and
[ADR 0004](adr/0004-cross-platform-abstraction.md).

Tier differences affect **quality and availability**, not type names:

| Rule | Meaning |
|------|---------|
| Same dogfood web package | L0 content is portable; materials/capabilities degrade |
| Same hit semantics | Host mirrors `resolveHit`; no per-OS app-facing hit API |
| Loud degrade | Missing material / WebView / permission → diagnostics, not silent blanks |
| Logical coordinates | Contracts stay logical; Shell converts physical at the boundary |

## Diagnostics expectations

Hosts should report:

- Material degrade (`ResolvedMaterial.degraded` + reason)
- Missing WebView runtime (e.g. WebView2 not installed)
- Permission denials with permission id + profile
- Hit-router conflicts / double-delivery detection in debug builds

## Related

- [Cross-platform abstraction](cross-platform-abstraction.md)
- [ADR 0004](adr/0004-cross-platform-abstraction.md)
- [Technology stack](technology-stack.md)
- [Materials](materials.md)
- [Input and hit testing](input-and-hit-testing.md)
- [Testing and acceptance](testing-and-acceptance.md)
- [Qt composition notes](research/qt-composition-notes.md)
- [Roadmap](roadmap.md)
- [Doc index](README.md)
