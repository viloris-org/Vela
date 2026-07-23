import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  NotifyEventChannels,
  NotifyMethods,
  VelaRpcErrorCodes,
} from "@vela/api";
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { registerNotifyPlugin } from "./host.ts";
import { createMockNotifySys } from "./mock-sys.ts";

describe("@vela/plugin-notify", () => {
  test("allow show + close with grant", async () => {
    const events = createHostEventBus();
    const mock = createMockNotifySys({ events });
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { notify: mock.facade },
        events,
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.NotifyShow] },
      },
    });
    registerNotifyPlugin(host);

    const result = await host.invoke({
      method: NotifyMethods.show,
      args: { title: "Hello", body: "World" },
    });
    expect(result).toEqual({ id: "notify-1" });
    expect(mock.shown).toHaveLength(1);
    expect(mock.shown[0]?.options.title).toBe("Hello");

    await host.invoke({
      method: NotifyMethods.close,
      args: { id: "notify-1" },
    });
    expect(mock.closed).toEqual(["notify-1"]);
  });

  test("deny without permission", async () => {
    const mock = createMockNotifySys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { notify: mock.facade },
      },
      capabilities: {
        default: { permissions: [] },
      },
    });
    registerNotifyPlugin(host);

    const rpc = await host.invokeRpc({
      requestId: "1",
      method: NotifyMethods.show,
      args: { title: "nope" },
    });
    expect(rpc.ok).toBe(false);
    if (!rpc.ok) {
      expect(rpc.error.code).toBe(VelaRpcErrorCodes.capabilityDenied);
    }
    expect(mock.shown).toHaveLength(0);
  });

  test("reject empty title", async () => {
    const mock = createMockNotifySys();
    const host = createCapabilityHost({
      api: {
        platform: "linux",
        sys: { notify: mock.facade },
      },
      capabilities: {
        default: { permissions: [BuiltinPermissions.NotifyShow] },
      },
    });
    registerNotifyPlugin(host);

    await expect(
      host.invoke({ method: NotifyMethods.show, args: { title: "" } }),
    ).rejects.toThrow(/title/);
  });

  test("simulateAction emits notify.action", () => {
    const events = createHostEventBus();
    const mock = createMockNotifySys({ events });
    const payloads: unknown[] = [];
    events.subscribe(NotifyEventChannels.action, (p) => payloads.push(p));
    mock.simulateAction({ id: "n1", action: "click" });
    expect(payloads).toEqual([{ id: "n1", action: "click" }]);
  });

  test("missing sys.notify fails closed", async () => {
    const host = createCapabilityHost({
      api: { platform: "linux" },
      capabilities: {
        default: { permissions: [BuiltinPermissions.NotifyShow] },
      },
    });
    registerNotifyPlugin(host);
    await expect(
      host.invoke({ method: NotifyMethods.show, args: { title: "x" } }),
    ).rejects.toThrow(/facade missing/);
  });
});
