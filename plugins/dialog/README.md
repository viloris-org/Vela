# @vela/plugin-dialog

First-party **T1** capability plugin: native file/folder open and save dialogs
(path pickers only — they do **not** read or write file contents).

| Surface | Value |
|---------|--------|
| Permissions | `dialog:open`, `dialog:save` |
| Methods | `dialog.open`, `dialog.save` |
| Systems | `HostAPI.sys.dialog` (injected; mock for tests) |
| Platforms | desktop (`macos` / `windows` / `linux`) |

## Host registration

```ts
import { createCapabilityHost } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";
import { registerDialogPlugin, createMockDialogSys } from "@vela/plugin-dialog";

const mock = createMockDialogSys({
  openPaths: ["/tmp/demo.txt"],
  savePath: "/tmp/out.txt",
});

const host = createCapabilityHost({
  api: {
    platform: "linux",
    sys: { dialog: mock.facade },
  },
  capabilities: {
    default: {
      permissions: [
        BuiltinPermissions.DialogOpen,
        BuiltinPermissions.DialogSave,
      ],
    },
  },
});
registerDialogPlugin(host);
```

## App (page)

```ts
const open = await window.vela.call("dialog.open", {
  title: "Open file",
  multiple: true,
  filters: [{ name: "Images", extensions: ["png", "jpg"] }],
});
// { canceled: boolean, paths: string[] }

const save = await window.vela.call("dialog.save", {
  defaultName: "export.json",
  filters: [{ name: "JSON", extensions: ["json"] }],
});
// { canceled: boolean, path: string | null }

// or thin wrappers:
import { openDialog, saveDialog } from "@vela/plugin-dialog/client";
await openDialog({ directory: true });
```

## Real OS dialogs

Not in this package. Desktop Host injects a real `sys.dialog` via
`@vela/sys-desktop` (`createDesktopDialogSys`). Until then, use
`createMockDialogSys` for unit tests and browser dogfood.

Pair with `fs:*` permissions when the app must actually read/write the chosen path.

## Verify

```bash
bun test plugins/dialog
bun run --filter @vela/plugin-dialog typecheck
```
