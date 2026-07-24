# @vela/plugin-clipboard

First-party **T1** capability plugin: system clipboard text read/write.

| Surface | Value |
|---------|--------|
| Permissions | `clipboard:read`, `clipboard:write` |
| Methods | `clipboard.read`, `clipboard.write` |
| Systems | `HostAPI.sys.clipboard` (injected; mock for tests) |
| Platforms | desktop (`macos` / `windows` / `linux`); mobile via host backend later |

## Host registration

```ts
import { createCapabilityHost } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import {
  registerClipboardPlugin,
  createMockClipboardSys,
} from "@vela/plugin-clipboard";

const mock = createMockClipboardSys({ text: "" });

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { clipboard: mock.facade },
  },
  capabilities: {
    default: {
      permissions: [
        BuiltinPermissions.ClipboardRead,
        BuiltinPermissions.ClipboardWrite,
      ],
    },
  },
});
registerClipboardPlugin(host);
```

## App (page)

```ts
await window.vela.call("clipboard.write", { text: "hello" });
const { text } = await window.vela.call("clipboard.read");

// or thin wrappers:
import { readClipboard, writeClipboard } from "@vela/plugin-clipboard/client";
await writeClipboard("hello");
```

## Real OS clipboard

Not in this package. Desktop Host injects a real `sys.clipboard` via
`@vela/sys-desktop` (`createDesktopClipboardSys`). Until then, use
`createMockClipboardSys` for unit tests and browser dogfood.

## Verify

```bash
bun test plugins/clipboard
bun run --filter @vela/plugin-clipboard typecheck
```
