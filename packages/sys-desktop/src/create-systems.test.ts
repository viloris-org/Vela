import { describe, expect, test } from "bun:test";
import { createDesktopSystems } from "./create-systems.ts";
import type { RunCommandRequest } from "./run.ts";

describe("package entry", () => {
  test("exports createDesktopSystems and surface factories from package root", async () => {
    const mod = await import("./index.ts");
    expect(typeof mod.createDesktopSystems).toBe("function");
    expect(typeof mod.createDesktopTraySys).toBe("function");
    expect(typeof mod.createDesktopDialogSys).toBe("function");
    expect(typeof mod.createDesktopNotifySys).toBe("function");
    expect(typeof mod.createDesktopClipboardSys).toBe("function");
    expect(typeof mod.createDesktopFsSys).toBe("function");
    expect(typeof mod.createDesktopShellSys).toBe("function");
  });
});

describe("createDesktopSystems", () => {
  test("wires notify + tray + dialog + clipboard + shell for linux with injectable run + memory tray", async () => {
    const calls: RunCommandRequest[] = [];
    const desktop = createDesktopSystems({
      platform: "linux",
      trayMode: "memory",
      appName: "Vela",
      run: async (req) => {
        calls.push(req);
        if (req.cmd === "which") {
          const name = req.args?.[0];
          const ok = name === "zenity" || name === "xclip";
          return { code: ok ? 0 : 1, stdout: "", stderr: "" };
        }
        if (req.cmd === "notify-send") {
          return { code: 0, stdout: "1\n", stderr: "" };
        }
        if (req.cmd === "zenity") {
          return { code: 0, stdout: "/tmp/picked.txt\n", stderr: "" };
        }
        if (req.cmd === "xclip") {
          if (req.args?.includes("-o")) {
            return { code: 0, stdout: "clip", stderr: "" };
          }
          return { code: 0, stdout: "", stderr: "" };
        }
        if (req.cmd === "xdg-open") {
          return { code: 0, stdout: "", stderr: "" };
        }
        return { code: 0, stdout: "", stderr: "" };
      },
    });

    expect(desktop.platform).toBe("linux");
    expect(desktop.sys.notify).toBeDefined();
    expect(desktop.sys.tray).toBeDefined();
    expect(desktop.sys.dialog).toBeDefined();
    expect(desktop.sys.clipboard).toBeDefined();
    expect(desktop.sys.shell).toBeDefined();
    expect(desktop.sys.fs).toBeUndefined();

    await desktop.sys.notify!.show({ title: "Hi", body: "there" });
    expect(calls.some((c) => c.cmd === "notify-send")).toBe(true);

    const { id } = await desktop.sys.tray!.create({ tooltip: "app" });
    await desktop.sys.tray!.remove(id);

    const opened = await desktop.sys.dialog!.open({ title: "Pick" });
    expect(opened).toEqual({ canceled: false, paths: ["/tmp/picked.txt"] });

    await desktop.sys.clipboard!.writeText("hi");
    expect(await desktop.sys.clipboard!.readText()).toBe("clip");

    await desktop.sys.shell!.openExternal("https://example.com");
    expect(calls.some((c) => c.cmd === "xdg-open")).toBe(true);

    await desktop.dispose();
  });

  test("rejects non-desktop platforms", () => {
    expect(() =>
      createDesktopSystems({ platform: "ios" }),
    ).toThrow(/not a desktop platform/);
  });
});
