# @vela/host-core

Portable **privileged Host** call router: register `vela.call` handlers, enforce
capability grants, return structured deny / RPC envelopes.

> **Status**: pure TypeScript policy + dispatch. No OS I/O, no Bun process split.  
> **Contracts**: `@vela/api` (`CapabilityHost`, `checkCapability`, `AppManifest`).  
> **Decisions**: [ADR 0002](../../docs/adr/0002-ipc-privilege.md), [ADR 0006](../../docs/adr/0006-ts-first-capabilities.md), [ADR 0007](../../docs/adr/0007-typescript-full-stack-host.md).

## Role

```text
App TS  --window.vela.call-->  (preload / Shell)  --RPC-->  Host
                                                          ▲
                                                   @vela/host-core
                                                   handle + require
                                                          │
                                                   injected HostAPI.sys
```

| Owns | Does not own |
|------|----------------|
| Method registry (`handle`) | Page / WebView / `window.vela` |
| `ctx.require` / grant checks | Real clipboard / fs / dialogs |
| `invoke` / `invokeRpc` | Zig Shell interop / UDS |
| Profile isolation | Material paint / hit routing |

Pair with `@vela/shell-core` for composition policy. Desktop Bun host will wire both.

## Usage

```ts
import { createCapabilityHost } from "@vela/host-core";
import { BuiltinPermissions } from "@vela/api";

const host = createCapabilityHost({
  api: { platform: "linux", sys: { /* inject facades */ } },
  capabilities: {
    default: { permissions: [BuiltinPermissions.ClipboardWrite] },
  },
});

host.handle("clipboard.write", async (args, ctx) => {
  ctx.require(BuiltinPermissions.ClipboardWrite);
  // … use host.api.sys after require
  return { ok: true };
});

const rpc = await host.invokeRpc({
  requestId: "1",
  method: "clipboard.write",
  args: { text: "hi" },
});
```

## Verify

```bash
bun test packages/host-core
bun run --filter @vela/host-core typecheck
```

## Related

- `@vela/api` capability + manifest modules
- [Capabilities and plugins](../../docs/capabilities-and-plugins.md)
- [Design gaps](../../docs/design-gaps.md) G-P1-6, G-P1-9, G-P1-11
