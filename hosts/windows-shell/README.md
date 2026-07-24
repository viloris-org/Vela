# hosts/windows-shell

**Phase 4 Windows composition host** — scaffold for **C++/WinRT + WebView2**.

> **Status**: scaffold only. No shipping MVP binary yet.  
> **Tier**: 1 (when complete): WebView2 + Mica/Acrylic + hit parity (behavioral, not pixel).  
> **Do not** put Windows sources under `hosts/desktop-shell` (that tree is macOS Swift L4).

Product contracts: `@vela/api`. Platform matrix: [docs/platform-support.md](../../docs/platform-support.md). Roadmap Phase 4: [docs/roadmap.md](../../docs/roadmap.md). Cross-host role: [ADR 0004](../../docs/adr/0004-cross-platform-abstraction.md).

## Stack lock

| Piece | Choice |
|-------|--------|
| Language | **C++/WinRT** |
| WebView | **WebView2** (Evergreen Runtime) |
| Materials (later) | Mica / Acrylic via DWM; loud `degraded` when unavailable |
| Process | Single native Shell + local preload (same spike shape as Linux/macOS) |
| Binary name | `vela-windows-shell.exe` |
| Default build out | `build/Release/vela-windows-shell.exe` (CMake) |

## Goals (when MVP lands)

1. HWND window open/show/close + DPI awareness.
2. WebView2 loads `--url` dogfood content.
3. Preload injects `window.vela` subset (same JSON protocol as Linux/macOS).
4. Sibling underlay + WebView2 (+ material host later).
5. Missing WebView2 Runtime → **loud** diagnostic (acceptance **W3**), never silent blank window.

## Non-goals (scaffold)

- Claiming Phase 4 complete
- Full W1–W3 without a Windows build machine
- Shared Rust UI core / Electron embed
- Merging into `desktop-shell`

## Module map (planned)

```text
hosts/windows-shell/
  README.md                 ← this file
  CMakeLists.txt            ← skeleton target
  src/
    main.cpp                ← CLI: --url / --version / --help
    window/
      window_host.h/.cpp    ← HWND, DPI, show/close
    webview/
      webview2_host.h/.cpp  ← environment + controller
    bridge/
      preload.js            ← keep in sync with linux/macOS preload protocol
      message_bridge.h/.cpp ← WebMessageReceived ↔ JSON req
    hit/                    ← resolveHit mirror (later)
    materials/              ← Mica/Acrylic (later)
```

## Build notes (Windows machine)

Prerequisites (intent):

- Visual Studio 2022 with C++ desktop workload
- Windows 11 SDK
- [WebView2 SDK](https://developer.microsoft.com/microsoft-edge/webview2/) / NuGet `Microsoft.Web.WebView2`
- CMake 3.20+

```bat
cd hosts\windows-shell
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
build\Release\vela-windows-shell.exe --url http://127.0.0.1:5174
```

Until the target links WebView2 for real, `main.cpp` is a **console stub** that prints version/help and explains missing runtime / incomplete host.

## CLI integration

`vela dev --platform windows` resolves:

- dir: `hosts/windows-shell`
- binary: `hosts/windows-shell/build/Release/vela-windows-shell.exe`

Automated build from the Bun CLI is **not** wired yet (returns a clear missing-binary message). Use `--browser` for mock dogfood on Windows until the host runs.

## Preload protocol

Same message-pass contract as `hosts/linux-shell/scripts/preload.js`:

- Page → host: `webkit` is not used; WebView2 uses `chrome.webview.postMessage` / `postMessage` — **adapt transport in preload**, keep `{type:req|res|event}` payloads identical.
- Host → page: `window.__velaHostDispatch(...)`
- Version string (when real): `0.0.1-windows-shell`

Scaffold `src/bridge/preload.js` documents both WebKit and WebView2 post paths.

## Acceptance (Phase 4)

| # | Scenario |
|---|----------|
| W1 | WebView2 + Mica/Acrylic layer (or degrade with reason) |
| W2 | Behavioral S2–S6 parity with macOS |
| W3 | Missing WebView2 → loud failure |

## Checklist

- [x] Host folder + stack lock + CMake skeleton
- [x] CLI path reserved (`tools/cli` platform `windows`)
- [x] Preload protocol stub (WebView2 transport notes)
- [ ] Real HWND + DPI
- [ ] WebView2 environment + navigate + inject
- [ ] Layer/hit store + material host
- [ ] W1–W3 on a Windows session

## References

- [platform-support.md](../../docs/platform-support.md)
- [macos desktop-shell](../desktop-shell) — sibling MVP pattern
- [linux-shell](../linux-shell) — working reference L4
- [zig-shell](../zig-shell) — future C ABI (Phase 2+; not required for spike)
