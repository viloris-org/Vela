# Sources/VelaShell

macOS Phase 1 MVP sources (AppKit + WKWebView).

Portable policy reference: **`@vela/shell-core`**. Hit algorithm SoT: **`@vela/api` `resolveHit`** (Swift mirror in `Hit/ResolveHit.swift`).

## Layout

```text
main.swift
App/ShellController.swift
Hit/HitRootView.swift
Hit/ResolveHit.swift
Layers/LayerTree.swift
WebView/MainWebViewFactory.swift
Bridge/MessageHandler.swift
Materials/MaterialHostView.swift
Geometry.swift
Resources/preload.js
```

## Dogfood layer ids

| Id | Kind | zIndex |
|----|------|--------|
| `underlay-native` | native underlay | 5 |
| `main-webview` | webview (web-shaped) | 10 |
| `toolbar-material` | material (app insert) | 30 |

Build: see `../../README.md`.
