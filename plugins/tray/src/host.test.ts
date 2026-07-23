import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  TrayEventChannels,
  TrayMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { registerTrayPlugin } from "./host.ts";
import { createMockTraySys } from "./mock-sys.ts";

describe("@vela/plugin-tray", () => {
  test("create / update / remove with grant", async () => {
    const events = createHostEventBus();
    const mock = createMockTraySys({ events });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { tray: mock.facade },
        events,
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.TrayManage] },
      },
    });
    registerTrayPlugin(host);

    const created = (await host.invoke({
      method: TrayMethods.create,
      args: {
        tooltip: "Vela",
        menu: [
          { type: "item", id: "open", label: "Open" },
          { type: "separator" },
          { type: "item", id: "quit", label: "Quit" },
        ],
      },
    })) as { id: string };

    expect(created.id).toBe("tray-1");
    expect(mock.trays.get("tray-1")?.tooltip).toBe("Vela");
    expect(mock.trays.get("tray-1")?.menu).toHaveLength(3);

    await host.invoke({
      method: TrayMethods.update,
      args: { id: "tray-1", tooltip: "Updated" },
    });
    expect(mock.trays.get("tray-1")?.tooltip).toBe("Updated");

    await host.invoke({
      method: TrayMethods.remove,
      args: { id: "tray-1" },
    });
    expect(mock.trays.has("tray-1")).toBe(false);
  });

  test("deny without tray:manage", async () => {
    const mock = createMockTraySys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { tray: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.NotifyShow] },
      },
    });
    registerTrayPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: TrayMethods.create,
      args: { tooltip: "x" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.trays.size).toBe(0);
  });

  test("simulateAction emits tray.action", () => {
    const events = createHostEventBus();
    const mock = createMockTraySys({ events });
    const payloads: unknown[] = [];
    events.subscribe(TrayEventChannels.action, (p) => payloads.push(p));
    mock.simulateAction({ id: "t1", action: "menu", itemId: "quit" });
    expect(payloads).toEqual([
      { id: "t1", action: "menu", itemId: "quit" },
    ]);
  });

  test("invalid menu item fails", async () => {
    const mock = createMockTraySys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { tray: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.TrayManage] },
      },
    });
    registerTrayPlugin(host);

    await expect(
      host.invoke({
        method: TrayMethods.create,
        args: { menu: [{ type: "item", label: "no-id" }] },
      }),
    ).rejects.toThrow(/id/);
  });
});
