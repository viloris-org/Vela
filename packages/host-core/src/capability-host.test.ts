import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  CapabilityDeniedError,
  VelaRpcErrorCodes,
  type CapabilityPlugin,
} from "@vela/api";
import { createCapabilityHost } from "./capability-host.ts";

describe("createCapabilityHost", () => {
  test("register + listMethods", () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
    });
    host.handle("clipboard.write", async () => ({ ok: true }));
    host.handle("notify.show", async () => ({ ok: true }));
    expect(host.listMethods()).toEqual(["clipboard.write", "notify.show"]);
  });

  test("duplicate handle throws", () => {
    const host = createCapabilityHost({ api: { platform: "linux" } });
    host.handle("a.b", async () => null);
    expect(() => host.handle("a.b", async () => null)).toThrow(/duplicate/);
  });

  test("deny when permission missing — handler uses require", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.NotifyShow] },
      },
    });
    host.handle("clipboard.write", async (args, ctx) => {
      ctx.require(BuiltinPermissions.ClipboardWrite);
      return { text: String((args as { text?: string }).text ?? "") };
    });

    await expect(
      host.invoke({ method: "clipboard.write", args: { text: "x" } }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: "clipboard.write",
      args: { text: "x" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
  });

  test("allow when permission granted", async () => {
    const writes: string[] = [];
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: {
          clipboard: {
            async readText() {
              return "";
            },
            async writeText(text) {
              writes.push(text);
            },
          },
        },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    host.handle("clipboard.write", async (args, ctx) => {
      ctx.require(BuiltinPermissions.ClipboardWrite);
      const text = String((args as { text?: string }).text ?? "");
      await host.api.sys?.clipboard?.writeText(text);
      return { ok: true };
    });

    const result = await host.invoke({
      method: "clipboard.write",
      args: { text: "hello" },
    });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual(["hello"]);
  });

  test("scoped fs:app-read requires resource in scope", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: {
          permissions: [BuiltinPermissions.FsAppRead],
          scopes: [{ type: "path", pattern: "app-data/**" }],
        },
      },
    });
    host.handle("fs.read", async (args, ctx) => {
      const path = String((args as { path?: string }).path ?? "");
      ctx.require(BuiltinPermissions.FsAppRead, path);
      return { path };
    });

    await expect(
      host.invoke({ method: "fs.read", args: { path: "/etc/passwd" } }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    const ok = await host.invoke({
      method: "fs.read",
      args: { path: "app-data/note.txt" },
    });
    expect(ok).toEqual({ path: "app-data/note.txt" });
  });

  test("profile isolation", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
        camera: { permissions: [BuiltinPermissions.CameraPreview] },
      },
    });
    host.handle("camera.open", async (_args, ctx) => {
      ctx.require(BuiltinPermissions.CameraPreview);
      return { open: true };
    });

    await expect(
      host.invoke({ method: "camera.open", profile: "default" }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    const r = await host.invoke({ method: "camera.open", profile: "camera" });
    expect(r).toEqual({ open: true });
  });

  test("unknown method → capability.denied envelope", async () => {
    const host = createCapabilityHost({ api: { platform: "linux" } });
    const rpc = await host.invokeRpc({
      requestId: "9",
      method: "no.such",
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe("capability.denied");
      expect(rpc.error.message).toMatch(/no handler/);
    }
  });

  test("plugin register(host) shape", async () => {
    const plugin: CapabilityPlugin = {
      name: "clipboard",
      register(host) {
        host.handle("clipboard.write", async (args, ctx) => {
          ctx.require(BuiltinPermissions.ClipboardWrite);
          return { text: String((args as { text?: string }).text ?? "") };
        });
      },
    };
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.ClipboardWrite] },
      },
    });
    await plugin.register(host);
    const r = await host.invokeRpc({
      requestId: "c1",
      method: "clipboard.write",
      args: { text: "z" },
    });
    expect(r).toEqual({ id: "c1", ok: true, result: { text: "z" } });
  });
});
