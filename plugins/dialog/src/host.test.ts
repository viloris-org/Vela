import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  DialogMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost } from "@vela/host-core";
import { registerDialogPlugin } from "./host.ts";
import { createMockDialogSys } from "./mock-sys.ts";

describe("@vela/plugin-dialog", () => {
  test("allow open + save with grants", async () => {
    const mock = createMockDialogSys({
      openPaths: ["/home/u/a.txt", "/home/u/b.txt"],
      savePath: "/home/u/out.txt",
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

    const opened = await host.invoke({
      method: DialogMethods.open,
      args: {
        title: "Pick",
        multiple: true,
        filters: [{ name: "Text", extensions: ["txt", ".md"] }],
      },
    });
    expect(opened).toEqual({
      canceled: false,
      paths: ["/home/u/a.txt", "/home/u/b.txt"],
    });
    expect(mock.openCalls).toHaveLength(1);
    expect(mock.openCalls[0]?.options.filters?.[0]?.extensions).toEqual([
      "txt",
      "md",
    ]);

    const saved = await host.invoke({
      method: DialogMethods.save,
      args: { defaultName: "out.txt" },
    });
    expect(saved).toEqual({ canceled: false, path: "/home/u/out.txt" });
    expect(mock.saveCalls).toHaveLength(1);
  });

  test("deny open without dialog:open", async () => {
    const mock = createMockDialogSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { dialog: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.DialogSave] },
      },
    });
    registerDialogPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: DialogMethods.open,
      args: {},
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.openCalls).toHaveLength(0);
  });

  test("deny save without dialog:save", async () => {
    const mock = createMockDialogSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { dialog: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.DialogOpen] },
      },
    });
    registerDialogPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "2",
      method: DialogMethods.save,
      args: {},
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.saveCalls).toHaveLength(0);
  });

  test("queueOpen reports canceled", async () => {
    const mock = createMockDialogSys();
    mock.queueOpen({ canceled: true, paths: [] });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { dialog: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.DialogOpen] },
      },
    });
    registerDialogPlugin(host);

    const result = await host.invoke({
      method: DialogMethods.open,
      args: { directory: true },
    });
    expect(result).toEqual({ canceled: true, paths: [] });
  });

  test("reject empty filter extensions", async () => {
    const mock = createMockDialogSys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { dialog: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.DialogOpen] },
      },
    });
    registerDialogPlugin(host);

    await expect(
      host.invoke({
        method: DialogMethods.open,
        args: { filters: [{ name: "Bad", extensions: [] }] },
      }),
    ).rejects.toThrow(/extensions/);
  });

  test("missing sys.dialog fails closed", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.DialogOpen] },
      },
    });
    registerDialogPlugin(host);
    await expect(
      host.invoke({ method: DialogMethods.open, args: {} }),
    ).rejects.toThrow(/facade missing/);
  });
});
