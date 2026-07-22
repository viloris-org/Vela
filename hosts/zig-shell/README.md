# hosts/zig-shell

Desktop **Zig interop layer** (L2.5): Bun ↔ Shell control plane and C ABI dispatch to L4 backends.

> **Status**: compilable skeleton + mock L4 + unit tests. No UDS listen, no real toolkit paint.  
> **Decisions**: [ADR 0005](../../docs/adr/0005-zig-interop-layer.md). Envelopes: `@vela/api` `protocol/rpc.ts`.  
> **Platforms**: Linux + macOS primary; Windows best-effort only.

## Role

```text
Bun host  --UDS/pipe + JSON (Phase 2)-->  Zig interop  --C ABI-->  L4 (Swift / Win / Linux)
                                         ▲ this package
```

| Owns | Does not own |
|------|----------------|
| RPC envelope codec + framing helpers | `window.vela` / page APIs |
| Method dispatch (`shell.*`, partial `window.*`) | Capability business plugins |
| Stable C ABI header + vtable | AppKit / WebView2 / GTK widgets |
| Mock L4 for tests | System material paint |
| Process main skeleton | `libs/vela-sys` systems surface ([ADR 0008](../../docs/adr/0008-zig-systems-surface.md)) |

Phase 1 macOS composition may stay Swift-only. This tree is early Phase 2 / G-P1-8 groundwork.

## Layout

```text
hosts/zig-shell/
  include/vela_shell_abi.h   # host-private C ABI (L4 wire)
  src/
    root.zig                 # library re-exports + test pull-in
    main.zig                 # CLI: --version / --self-test
    abi/                     # types + BackendVTable
    rpc/                     # envelope, length-prefix frame, dispatch
    backend/mock.zig         # in-memory L4
    util/err.zig             # status ↔ RPC error codes
  build.zig
```

## Build / test

Requires [Zig](https://ziglang.org/) **0.16.x** (`zig version`).

```bash
cd hosts/zig-shell
zig build
zig build test
./zig-out/bin/vela-shell --version
./zig-out/bin/vela-shell --self-test
```

Installed artifacts:

- `zig-out/bin/vela-shell`
- `zig-out/lib/libvela_shell.a` (name may vary by target)
- `zig-out/include/vela_shell_abi.h`

## C ABI

`include/vela_shell_abi.h` is **host-private**. L4 backends implement a `vela_shell_backend_vtable` (function pointers). Zig holds the vtable and calls into L4; it is not a second public app SDK.

Groups: lifecycle, window, webview, layer, hit, material, events.

## RPC (no socket yet)

Payload shapes match `@vela/api`:

- Request: `{ id, channel, method, args? }`
- Response: `{ id, ok: true, result? }` | `{ id, ok: false, error: { code, message } }`

Implemented methods:

| channel | method | notes |
|---------|--------|--------|
| `shell` | `ping` | `{ pong, backend }` |
| `shell` | `version` | package version |
| `window` | `create` / `show` / `getState` | via mock vtable |

Unknown methods → `unsupported.platform`. Framing helper: **u32 LE length + JSON body** (implementation detail; contracts lock payloads only).

## Non-goals (current)

- Bun process / real UDS endpoint
- Swift `@_cdecl` link or GTK/WebView
- `libs/vela-sys` / plugin native kernels
- Pure `resolveHit` port into Zig
- Capability / `call` engine

## References

- [Cross-platform abstraction](../../docs/cross-platform-abstraction.md)
- [ADR 0002 IPC](../../docs/adr/0002-ipc-privilege.md)
- [ADR 0005 Zig interop](../../docs/adr/0005-zig-interop-layer.md)
- `packages/api/src/protocol/rpc.ts`
