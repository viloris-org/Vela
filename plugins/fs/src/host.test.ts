import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  FsMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost } from "@vela/host-core";
import { registerFsPlugin } from "./host.ts";
import { createMockFsSys } from "./mock-sys.ts";

describe("@vela/plugin-fs", () => {
  test("allow read + write with grants", async () => {
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
        },
      },
    });
    registerFsPlugin(host);

    const read = await host.invoke({
      method: FsMethods.read,
      args: { path: "notes/a.txt" },
    });
    expect(read).toEqual({ data: "hello" });
    expect(mock.reads).toEqual(["notes/a.txt"]);

    const written = await host.invoke({
      method: FsMethods.write,
      args: { path: "notes/b.txt", data: "world" },
    });
    expect(written).toEqual({ ok: true });
    expect(mock.files.get("notes/b.txt")).toBe("world");
  });

  test("deny read without fs:app-read", async () => {
    const mock = createMockFsSys({ files: { "a.txt": "x" } });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { fs: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.FsAppWrite] },
      },
    });
    registerFsPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: FsMethods.read,
      args: { path: "a.txt" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.reads).toHaveLength(0);
  });

  test("deny write without fs:app-write", async () => {
    const mock = createMockFsSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { fs: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.FsAppRead] },
      },
    });
    registerFsPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "2",
      method: FsMethods.write,
      args: { path: "a.txt", data: "x" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.writes).toHaveLength(0);
  });

  test("scope miss denies even with permission", async () => {
    const mock = createMockFsSys({ files: { "app-data/ok.txt": "1" } });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { fs: mock.facade },
      },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.FsAppRead],
          scopes: [{ type: "path", pattern: "app-data/**" }],
        },
      },
    });
    registerFsPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "3",
      method: FsMethods.read,
      args: { path: "secret/x.txt" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
      expect(rpc.error.message).toMatch(/out of scope/i);
    }
    expect(mock.reads).toHaveLength(0);

    const ok = await host.invoke({
      method: FsMethods.read,
      args: { path: "app-data/ok.txt" },
    });
    expect(ok).toEqual({ data: "1" });
  });

  test("reject path escape and absolute paths", async () => {
    const mock = createMockFsSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { fs: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.FsAppRead] },
      },
    });
    registerFsPlugin(host);

    await expect(
      host.invoke({ method: FsMethods.read, args: { path: "../etc/passwd" } }),
    ).rejects.toThrow(/escapes|absolute|app-relative/i);

    await expect(
      host.invoke({ method: FsMethods.read, args: { path: "/etc/passwd" } }),
    ).rejects.toThrow(/app-relative|absolute/i);
  });

  test("missing sys.fs fails closed", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.FsAppRead] },
      },
    });
    registerFsPlugin(host);
    await expect(
      host.invoke({ method: FsMethods.read, args: { path: "a.txt" } }),
    ).rejects.toThrow(/facade missing/);
  });
});
