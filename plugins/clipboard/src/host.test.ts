import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  ClipboardMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost } from "@vela/host-core";
import { registerClipboardPlugin } from "./host.ts";
import { createMockClipboardSys } from "./mock-sys.ts";

describe("@vela/plugin-clipboard", () => {
  test("allow read + write with grants", async () => {
    const mock = createMockClipboardSys({ text: "seed" });
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

    const read = await host.invoke({ method: ClipboardMethods.read });
    expect(read).toEqual({ text: "seed" });
    expect(mock.reads).toBe(1);

    const written = await host.invoke({
      method: ClipboardMethods.write,
      args: { text: "hello" },
    });
    expect(written).toEqual({ ok: true });
    expect(mock.writes).toEqual(["hello"]);
    expect(mock.text).toBe("hello");
  });

  test("deny read without clipboard:read", async () => {
    const mock = createMockClipboardSys({ text: "secret" });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { clipboard: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    registerClipboardPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: ClipboardMethods.read,
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.reads).toBe(0);
  });

  test("deny write without clipboard:write", async () => {
    const mock = createMockClipboardSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { clipboard: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardRead] },
      },
    });
    registerClipboardPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "2",
      method: ClipboardMethods.write,
      args: { text: "nope" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.writes).toHaveLength(0);
  });

  test("reject non-string text", async () => {
    const mock = createMockClipboardSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { clipboard: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    registerClipboardPlugin(host);

    await expect(
      host.invoke({
        method: ClipboardMethods.write,
        args: { text: 42 },
      }),
    ).rejects.toThrow(/text must be a string/);
  });

  test("missing sys.clipboard fails closed", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    registerClipboardPlugin(host);
    await expect(
      host.invoke({
        method: ClipboardMethods.write,
        args: { text: "x" },
      }),
    ).rejects.toThrow(/facade missing/);
  });
});
