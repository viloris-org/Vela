# @vela/sys-desktop

Desktop **Host systems facades** for the three desktop platforms: **Linux**, **macOS**, **Windows**.

Inject into `HostAPI.sys` after capability checks (T1). Does **not** run in the WebView.

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| **notify** | `notify-send` (`--print-id` + `gdbus` close/replace) | `osascript` `display notification` | PowerShell WinRT toast → balloon fallback |
| **tray** | Python3 + AppIndicator/Ayatana + GTK3 helper | Swift `NSStatusItem` helper | PowerShell `NotifyIcon` helper |
| **dialog** | `zenity` / `kdialog` | `osascript` choose file | PowerShell WinForms |

## Usage

```ts
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { createDesktopSystems } from "@vela/sys-desktop";
import { registerNotifyPlugin } from "@vela/plugin-notify";
import { registerTrayPlugin } from "@vela/plugin-tray";
import { registerDialogPlugin } from "@vela/plugin-dialog";
import { BuiltinPermissions } from "@vela/api";

const events = createHostEventBus();
const desktop = createDesktopSystems({
  platform: "auto",       // or "linux" | "macos" | "windows"
  events,
  appName: "MyApp",
  // trayMode: "memory",  // headless CI — no real icon
});

const host = createCapabilityHost({
  api: {
    platform: desktop.platform,
    sys: desktop.sys, // notify + tray + dialog
    events,
  },
  capabilities: {
    default: {
      permissions: [
        BuiltinPermissions.NotifyShow,
        BuiltinPermissions.TrayManage,
        BuiltinPermissions.DialogOpen,
        BuiltinPermissions.DialogSave,
      ],
    },
  },
});
registerNotifyPlugin(host);
registerTrayPlugin(host);
registerDialogPlugin(host);

// … later
await desktop.dispose();
```

**Notify events:** CLI backends (`notify-send` / osascript / PowerShell toast) implement show/close only. Action/click delivery needs a richer long-lived helper (same class as tray). Subscribe handlers under mock/tests may work; production OS notify does not emit `notify.action` yet.

## Tray helpers

Real tray icons spawn a long-lived helper (JSON-lines over stdio):

| Platform | Command | Script |
|----------|---------|--------|
| Linux | `python3` | `helpers/tray-linux.py` |
| macOS | `swift` | `helpers/tray-macos.swift` |
| Windows | `powershell.exe` | `helpers/tray-windows.ps1` |

**Linux deps:** `python3`, PyGObject, `gir1.2-ayatanaappindicator3-0.1` or `gir1.2-appindicator3-0.1`, GTK3.

**macOS deps:** Xcode/CLI tools (`swift`), AppKit session (GUI login).

**Windows deps:** PowerShell, WinForms (standard desktop).

Headless CI should use `trayMode: "memory"`.

## Notify tools

| Platform | Tool |
|----------|------|
| Linux | `notify-send` (`libnotify-bin`) |
| macOS | `osascript` |
| Windows | `powershell.exe` |

## Architecture note

This is **T1 Host TS + OS tools / helpers** — valid interim per ADR 0006.  
Long-term first-party kernels may move behind a Zig systems surface ([ADR 0008](../../docs/adr/0008-zig-systems-surface.md)) without changing `vela.call` method names.

## Verify

```bash
bun test packages/sys-desktop
bun run --filter @vela/sys-desktop typecheck
```
