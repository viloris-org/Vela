# @vela/plugin-notify

First-party **T1** capability plugin: desktop user notifications.

| Surface | Value |
|---------|--------|
| Permission | `notify:show` (`BuiltinPermissions.NotifyShow`) |
| Methods | `notify.show`, `notify.close` |
| Events | `notify.action` (`NotifyEventChannels.action`) |
| Systems | `HostAPI.sys.notify` (injected; mock for tests) |

## Host registration

```ts
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import { registerNotifyPlugin, createMockNotifySys } from "@vela/plugin-notify";

const events = createHostEventBus();
const mock = createMockNotifySys({ events });

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { notify: mock.facade },
    events,
  },
  capabilities: {
    default: { permissions: [BuiltinPermissions.NotifyShow] },
  },
});
registerNotifyPlugin(host);
```

## App (page)

```ts
await window.vela.call("notify.show", { title: "Hi", body: "…" });
// or thin wrapper:
import { showNotification } from "@vela/plugin-notify/client";
await showNotification({ title: "Hi" });

window.vela.events.subscribe("notify.action", (payload) => { /* … */ });
```

## Real OS delivery

Use `@vela/sys-desktop` on the Host:

```ts
import { createDesktopSystems } from "@vela/sys-desktop";

const desktop = createDesktopSystems({ platform: "auto", events });
// pass desktop.sys.notify into HostAPI.sys
```

| Platform | Backend |
|----------|---------|
| Linux | `notify-send` |
| macOS | `osascript` |
| Windows | PowerShell toast / balloon |

For unit tests without OS tools, keep `createMockNotifySys`.

## Verify

```bash
bun test plugins/notify
bun run --filter @vela/plugin-notify typecheck
```
