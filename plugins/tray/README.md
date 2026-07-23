# @vela/plugin-tray

First-party **T1** capability plugin: system tray / status item (not a composition Layer).

| Surface | Value |
|---------|--------|
| Permission | `tray:manage` (`BuiltinPermissions.TrayManage`) |
| Methods | `tray.create`, `tray.update`, `tray.remove` |
| Events | `tray.action` (`TrayEventChannels.action`) |
| Systems | `HostAPI.sys.tray` (injected; mock for tests) |
| Platforms | desktop (`macos` / `windows` / `linux`) |

## Host registration

```ts
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import { registerTrayPlugin, createMockTraySys } from "@vela/plugin-tray";

const events = createHostEventBus();
const mock = createMockTraySys({ events });

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { tray: mock.facade },
    events,
  },
  capabilities: {
    default: { permissions: [BuiltinPermissions.TrayManage] },
  },
});
registerTrayPlugin(host);
```

## App (page)

```ts
const { id } = await window.vela.call("tray.create", {
  tooltip: "My App",
  menu: [
    { type: "item", id: "open", label: "Open" },
    { type: "separator" },
    { type: "item", id: "quit", label: "Quit" },
  ],
});

window.vela.events.subscribe("tray.action", (payload) => {
  // { id, action: "click" | "menu" | …, itemId? }
});
```

Tray is **OS chrome**, not `layers.insert`. Real icons/menus come from `@vela/sys-desktop`:

```ts
import { createDesktopSystems } from "@vela/sys-desktop";

const desktop = createDesktopSystems({
  platform: "auto",
  events,
  // trayMode: "memory", // headless CI
});
// desktop.sys.tray → HostAPI.sys.tray
```

| Platform | Helper |
|----------|--------|
| Linux | `python3` + AppIndicator/Ayatana |
| macOS | `swift` + `NSStatusItem` |
| Windows | PowerShell `NotifyIcon` |

## Verify

```bash
bun test plugins/tray
bun run --filter @vela/plugin-tray typecheck
```
