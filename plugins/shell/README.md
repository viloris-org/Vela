# @vela/plugin-shell

First-party **T1** capability plugin: open external URLs with the system handler.

| Surface | Value |
|---------|--------|
| Permission | `shell:open-external` |
| Method | `shell.openExternal` |
| Systems | `HostAPI.sys.shell` (injected; mock for tests) |
| Platforms | desktop (`macos` / `windows` / `linux`); mobile via host backend later |

## Host registration

```ts
import { createCapabilityHost } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import {
  registerShellPlugin,
  createMockShellSys,
} from "@vela/plugin-shell";

const mock = createMockShellSys();

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { shell: mock.facade },
  },
  capabilities: {
    default: {
      permissions: [BuiltinPermissions.ShellOpenExternal],
      // optional: further restrict destinations
      // scopes: [{ type: "url", pattern: "https://docs.example.com/**" }],
    },
  },
});
registerShellPlugin(host);
```

## App (page)

```ts
await window.vela.call("shell.openExternal", {
  url: "https://example.com",
});

// or thin wrapper:
import { openExternal } from "@vela/plugin-shell/client";
await openExternal("https://example.com");
```

## Safety

1. Permission check (`shell:open-external`) — default deny.
2. URL parse + scheme allowlist (`http:`, `https:`, `mailto:` only by default).
3. Optional URL scopes on the grant (`resource` = normalized href).
4. OS open only after the above; never pass raw page strings to the shell.

## Real OS open

Not in this package. Desktop Host injects `sys.shell` via
`@vela/sys-desktop` (`createDesktopShellSys`). Until then, use
`createMockShellSys` for unit tests and browser dogfood.

## Verify

```bash
bun test plugins/shell
bun run --filter @vela/plugin-shell typecheck
```
