# @vela/plugin-fs

First-party **T1** capability plugin: read/write text files under an **app data sandbox**.

| Surface | Value |
|---------|--------|
| Permissions | `fs:app-read`, `fs:app-write` |
| Methods | `fs.read`, `fs.write` |
| Systems | `HostAPI.sys.fs` (injected; mock for tests) |
| Paths | **App-relative** only (`notes/a.txt`); absolute / `..` escape rejected |

## Host registration

```ts
import { createCapabilityHost } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import { registerFsPlugin, createMockFsSys } from "@vela/plugin-fs";

const mock = createMockFsSys({ files: { "notes/a.txt": "hello" } });

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { fs: mock.facade },
  },
  capabilities: {
    default: {
      permissions: [
        BuiltinPermissions.FsAppRead,
        BuiltinPermissions.FsAppWrite,
      ],
      // optional path scopes — resource is the normalized relative path
      scopes: [{ type: "path", pattern: "notes/**" }],
    },
  },
});
registerFsPlugin(host);
```

## App (page)

```ts
const { data } = await window.vela.call("fs.read", { path: "notes/a.txt" });
await window.vela.call("fs.write", { path: "notes/b.txt", data: "world" });

// or thin wrappers:
import { readAppFile, writeAppFile } from "@vela/plugin-fs/client";
await writeAppFile("notes/b.txt", "world");
```

## Real OS filesystem

Not in this package. Desktop Host injects a sandboxed `sys.fs` via
`@vela/sys-desktop` (`createDesktopFsSys({ root })`). Until then, use
`createMockFsSys` for unit tests.

Pair with `dialog:*` when the user picks a path outside the sandbox — that is a
separate grant path (not `fs:app-*`).

## Verify

```bash
bun test plugins/fs
bun run --filter @vela/plugin-fs typecheck
```
