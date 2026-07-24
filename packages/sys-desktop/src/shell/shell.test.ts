import { describe, expect, test } from "bun:test";
import type { RunCommandRequest } from "../run.ts";
import { createDesktopShellSys } from "./index.ts";

describe("createDesktopShellSys", () => {
  test("linux uses xdg-open", async () => {
    const calls: RunCommandRequest[] = [];
    const shell = createDesktopShellSys({
      platform: "linux",
      run: async (req) => {
        calls.push(req);
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await shell.openExternal("https://example.com");
    expect(calls).toEqual([
      {
        cmd: "xdg-open",
        args: ["https://example.com"],
        timeoutMs: 15_000,
      },
    ]);
  });

  test("macos uses open", async () => {
    const calls: RunCommandRequest[] = [];
    const shell = createDesktopShellSys({
      platform: "macos",
      run: async (req) => {
        calls.push(req);
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await shell.openExternal("https://example.com");
    expect(calls[0]?.cmd).toBe("open");
    expect(calls[0]?.args).toEqual(["https://example.com"]);
  });

  test("windows uses cmd start", async () => {
    const calls: RunCommandRequest[] = [];
    const shell = createDesktopShellSys({
      platform: "windows",
      run: async (req) => {
        calls.push(req);
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await shell.openExternal("https://example.com");
    expect(calls[0]?.cmd).toBe("cmd.exe");
    expect(calls[0]?.args).toEqual(["/c", "start", "", "https://example.com"]);
  });

  test("non-zero exit fails", async () => {
    const shell = createDesktopShellSys({
      platform: "linux",
      run: async () => ({
        code: 1,
        stdout: "",
        stderr: "no handler",
      }),
    });
    await expect(shell.openExternal("https://example.com")).rejects.toThrow(
      /no handler|exit/,
    );
  });

  test("rejects non-desktop platform", () => {
    expect(() =>
      createDesktopShellSys({ platform: "ios" }),
    ).toThrow(/desktop platform/);
  });
});
