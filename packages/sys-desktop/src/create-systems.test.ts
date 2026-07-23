import { describe, expect, test } from "bun:test";
import { createDesktopSystems } from "./create-systems.ts";
import type { RunCommandRequest } from "./run.ts";

describe("package entry", () => {
  test("exports createDesktopSystems and tray surface from package root", async () => {
    const mod = await import("./index.ts");
    expect(typeof mod.createDesktopSystems).toBe("function");
    expect(typeof mod.createDesktopTraySys).toBe("function");
    expect(typeof mod.createDesktopDialogSys).toBe("function");
    expect(typeof mod.createDesktopNotifySys).toBe("function");
  });
});

describe("createDesktopSystems", () => {
  test("wires notify + tray + dialog for linux with injectable run + memory tray", async () => {
    const calls: RunCommandRequest[] = [];
    const desktop = createDesktopSystems({
      platform: "linux",
      trayMode: "memory",
      appName: "Vela",
      run: async (req) => {
        calls.push(req);
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
          return { code: 0, stdout: "/tmp/picked.txt\n", stderr: "" };
        }
        return { code: 0, stdout: "", stderr: "" };
      },
    });

    expect(desktop.platform).toBe("linux");
    expect(desktop.sys.notify).toBeDefined();
    expect(desktop.sys.tray).toBeDefined();
    expect(desktop.sys.dialog).toBeDefined();

    await desktop.sys.notify!.show({ title: "Hi", body: "there" });
    expect(calls.some((c) => c.cmd === "notify-send")).toBe(true);

    const { id } = await desktop.sys.tray!.create({ tooltip: "app" });
    await desktop.sys.tray!.remove(id);

    const opened = await desktop.sys.dialog!.open({ title: "Pick" });
    expect(opened).toEqual({ canceled: false, paths: ["/tmp/picked.txt"] });

    await desktop.dispose();
  });

  test("rejects non-desktop platforms", () => {
    expect(() =>
      createDesktopSystems({ platform: "ios" }),
    ).toThrow(/not a desktop platform/);
  });
});
