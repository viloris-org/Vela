/**
 * End-to-end: plugin host handlers + desktop systems (memory tray, scripted notify).
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BuiltinPermissions,
  ClipboardMethods,
  DialogMethods,
  FsMethods,
  NotifyMethods,
  TrayMethods,
} from "@vela/api";
import { createCapabilityHost, createHostEventBus } from "@vela/host-core";
import { registerNotifyPlugin } from "../../../plugins/notify/src/host.ts";
import { registerTrayPlugin } from "../../../plugins/tray/src/host.ts";
import { registerDialogPlugin } from "../../../plugins/dialog/src/host.ts";
import { registerClipboardPlugin } from "../../../plugins/clipboard/src/host.ts";
import { registerFsPlugin } from "../../../plugins/fs/src/host.ts";
import { createDesktopSystems } from "./create-systems.ts";

// Note: relative imports into plugins/ for monorepo integration test only.

describe("plugins + sys-desktop integration", () => {
  test("notify + tray + dialog + clipboard + fs through capability host", async () => {
    const events = createHostEventBus();
    const root = await mkdtemp(join(tmpdir(), "vela-int-fs-"));
    try {
      const desktop = createDesktopSystems({
        platform: "linux",
        events,
        trayMode: "memory",
        fs: { root },
        run: async (req) => {
          if (req.cmd === "which") {
            const name = req.args?.[0];
            const ok = name === "zenity" || name === "xclip";
            return { code: ok ? 0 : 1, stdout: "", stderr: "" };
          }
          if (req.cmd === "notify-send") {
            return { code: 0, stdout: "1\n", stderr: "" };
          }
          if (req.cmd === "zenity") {
            return { code: 0, stdout: "/tmp/from-plugin.txt\n", stderr: "" };
          }
          if (req.cmd === "xclip") {
            if (req.args?.includes("-o")) {
              return { code: 0, stdout: "from-sys", stderr: "" };
            }
            return { code: 0, stdout: "", stderr: "" };
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
              BuiltinPermissions.ClipboardRead,
              BuiltinPermissions.ClipboardWrite,
              BuiltinPermissions.FsAppRead,
              BuiltinPermissions.FsAppWrite,
            ],
          },
        },
      });
      registerNotifyPlugin(host);
      registerTrayPlugin(host);
      registerDialogPlugin(host);
      registerClipboardPlugin(host);
      registerFsPlugin(host);

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

      await host.invoke({
        method: ClipboardMethods.write,
        args: { text: "clip-me" },
      });
      const clip = await host.invoke({ method: ClipboardMethods.read });
      expect(clip).toEqual({ text: "from-sys" });

      await host.invoke({
        method: FsMethods.write,
        args: { path: "notes/a.txt", data: "sandbox" },
      });
      const file = await host.invoke({
        method: FsMethods.read,
        args: { path: "notes/a.txt" },
      });
      expect(file).toEqual({ data: "sandbox" });

      await desktop.dispose();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
