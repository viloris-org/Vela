/**
 * End-to-end: plugin host handlers + desktop systems (memory tray, scripted notify).
 */
import { describe, expect, test } from "bun:test";
import {
  BuiltinPermissions,
  DialogMethods,
  NotifyMethods,
  TrayMethods,
} from "@vela/api";
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { registerNotifyPlugin } from "../../../plugins/notify/src/host.ts";
import { registerTrayPlugin } from "../../../plugins/tray/src/host.ts";
import { registerDialogPlugin } from "../../../plugins/dialog/src/host.ts";
import { createDesktopSystems } from "./create-systems.ts";

// Note: relative imports into plugins/ for monorepo integration test only.

describe("plugins + sys-desktop integration", () => {
  test("notify + tray + dialog through capability host", async () => {
    const events = createHostEventBus();
    const desktop = createDesktopSystems({
      platform: "linux",
      events,
      trayMode: "memory",
      run: async (req) => {
        if (req.cmd === "which") {
          return {
            code: req.args?.[0] === "zenity" ? 0 : 1,
            stdout: "",
            stderr: "",
          };
        }
        if (req.cmd === "notify-send") {
          return { code: 0, stdout: "1\n", stderr: "" };
        }
        if (req.cmd === "zenity") {
          return { code: 0, stdout: "/tmp/from-plugin.txt\n", stderr: "" };
        }
        return { code: 0, stdout: "", stderr: "" };
      },
    });

    const host = createCapabilityHost({
      api: {
        platform: desktop.platform,
        sys: desktop.sys,
        events,
      },
      capabilities: {
        default: {
          permissions: [
            BuiltinPermissions.NotifyShow,
            BuiltinPermissions.TrayManage,
            BuiltinPermissions.DialogOpen,
          ],
        },
      },
    });
    registerNotifyPlugin(host);
    registerTrayPlugin(host);
    registerDialogPlugin(host);

    const n = await host.invoke({
      method: NotifyMethods.show,
      args: { title: "From plugin", body: "ok" },
    });
    expect(n).toMatchObject({ id: expect.any(String) });

    const t = (await host.invoke({
      method: TrayMethods.create,
      args: {
        tooltip: "Vela",
        menu: [{ type: "item", id: "a", label: "A" }],
      },
    })) as { id: string };
    expect(t.id).toBeTruthy();

    await host.invoke({
      method: TrayMethods.remove,
      args: { id: t.id },
    });

    const opened = await host.invoke({
      method: DialogMethods.open,
      args: { title: "Pick" },
    });
    expect(opened).toEqual({
      canceled: false,
      paths: ["/tmp/from-plugin.txt"],
    });

    await desktop.dispose();
  });
});
