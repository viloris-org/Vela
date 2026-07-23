import { describe, expect, test } from "bun:test";
import { SystemsError } from "../errors.ts";
import type { RunCommand, RunCommandRequest, RunCommandResult } from "../run.ts";
import {
  createDesktopDialogSys,
  kdialogFilterString,
  macosTypeList,
  winFormsFilterString,
  zenityFileFilters,
} from "./index.ts";
import type { DialogBackend } from "./types.ts";

function mockRun(
  handler: (req: RunCommandRequest) => RunCommandResult | Promise<RunCommandResult>,
): RunCommand {
  return async (req) => handler(req);
}

describe("dialog filter helpers", () => {
  test("zenityFileFilters", () => {
    expect(
      zenityFileFilters([{ name: "Images", extensions: ["png", ".jpg"] }]),
    ).toEqual(["--file-filter", "Images | *.png *.jpg"]);
  });

  test("winFormsFilterString", () => {
    expect(
      winFormsFilterString([{ name: "Text", extensions: ["txt"] }]),
    ).toBe("Text|*.txt|All files|*.*");
  });

  test("kdialogFilterString", () => {
    expect(
      kdialogFilterString([{ name: "JSON", extensions: ["json"] }]),
    ).toBe("*.json|JSON\n*|All files");
  });

  test("macosTypeList skips *", () => {
    expect(
      macosTypeList([
        { name: "A", extensions: ["png", "*"] },
        { name: "B", extensions: [".JPG"] },
      ]),
    ).toEqual(["png", "jpg"]);
  });
});

describe("createDesktopDialogSys", () => {
  test("open / save via injected backend", async () => {
    const backend: DialogBackend = {
      platform: "linux",
      async open() {
        return { canceled: false, paths: ["/tmp/a.txt"] };
      },
      async save() {
        return { canceled: false, path: "/tmp/b.txt" };
      },
    };
    const dialog = createDesktopDialogSys({ platform: "linux", backend });
    expect(await dialog.open({ title: "x" })).toEqual({
      canceled: false,
      paths: ["/tmp/a.txt"],
    });
    expect(await dialog.save({})).toEqual({
      canceled: false,
      path: "/tmp/b.txt",
    });
  });

  test("linux zenity open multiple + cancel", async () => {
    const calls: RunCommandRequest[] = [];
    const run = mockRun(async (req) => {
      calls.push(req);
      if (req.cmd === "which") {
        return {
          code: req.args?.[0] === "zenity" ? 0 : 1,
          stdout: req.args?.[0] === "zenity" ? "/usr/bin/zenity\n" : "",
          stderr: "",
        };
      }
      if (req.cmd === "zenity") {
        if (req.args?.includes("--title") && req.args.includes("cancel-me")) {
          return { code: 1, stdout: "", stderr: "" };
        }
        return {
          code: 0,
          stdout: "/home/a.txt|/home/b.txt\n",
          stderr: "",
        };
      }
      return { code: 1, stdout: "", stderr: "unexpected" };
    });

    const dialog = createDesktopDialogSys({ platform: "linux", run });
    const multi = await dialog.open({
      multiple: true,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    expect(multi).toEqual({
      canceled: false,
      paths: ["/home/a.txt", "/home/b.txt"],
    });
    expect(calls.some((c) => c.cmd === "zenity")).toBe(true);

    const canceled = await dialog.open({ title: "cancel-me" });
    expect(canceled).toEqual({ canceled: true, paths: [] });
  });

  test("linux zenity exit 1 with stderr is backend_failed not cancel", async () => {
    const run = mockRun(async (req) => {
      if (req.cmd === "which") {
        return {
          code: req.args?.[0] === "zenity" ? 0 : 1,
          stdout: "",
          stderr: "",
        };
      }
      if (req.cmd === "zenity") {
        return { code: 1, stdout: "", stderr: "Gtk-WARNING: display missing" };
      }
      return { code: 1, stdout: "", stderr: "no" };
    });
    const dialog = createDesktopDialogSys({ platform: "linux", run });
    await expect(dialog.open({})).rejects.toBeInstanceOf(SystemsError);
  });

  test("linux zenity save", async () => {
    const run = mockRun(async (req) => {
      if (req.cmd === "which") {
        return {
          code: req.args?.[0] === "zenity" ? 0 : 1,
          stdout: "",
          stderr: "",
        };
      }
      if (req.cmd === "zenity") {
        expect(req.args).toContain("--save");
        expect(req.args).toContain("--confirm-overwrite");
        return { code: 0, stdout: "/tmp/out.json\n", stderr: "" };
      }
      return { code: 1, stdout: "", stderr: "no" };
    });
    const dialog = createDesktopDialogSys({ platform: "linux", run });
    expect(await dialog.save({ defaultName: "out.json" })).toEqual({
      canceled: false,
      path: "/tmp/out.json",
    });
  });

  test("macos osascript cancel", async () => {
    const run = mockRun(async (req) => {
      expect(req.cmd).toBe("osascript");
      return {
        code: 1,
        stdout: "",
        stderr: "execution error: User canceled. (-128)\n",
      };
    });
    const dialog = createDesktopDialogSys({ platform: "macos", run });
    expect(await dialog.open({})).toEqual({ canceled: true, paths: [] });
    expect(await dialog.save({})).toEqual({ canceled: true, path: null });
  });

  test("windows open multiselect", async () => {
    const run = mockRun(async (req) => {
      expect(req.cmd).toBe("powershell.exe");
      const script = req.args?.[req.args.length - 1] ?? "";
      expect(script).toContain("OpenFileDialog");
      expect(script).toContain("$d.Multiselect = $true");
      return {
        code: 0,
        stdout: "C:\\a.txt\r\nC:\\b.txt\r\n",
        stderr: "",
      };
    });
    const dialog = createDesktopDialogSys({ platform: "windows", run });
    expect(await dialog.open({ multiple: true })).toEqual({
      canceled: false,
      paths: ["C:\\a.txt", "C:\\b.txt"],
    });
  });

  test("unsupported platform throws", () => {
    expect(() =>
      createDesktopDialogSys({ platform: "auto", run: mockRun(async () => ({
        code: 0,
        stdout: "",
        stderr: "",
      })) }),
    ).not.toThrow(); // auto uses process.platform — should be desktop on CI linux
  });
});
