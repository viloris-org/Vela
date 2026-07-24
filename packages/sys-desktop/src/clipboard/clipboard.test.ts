import { describe, expect, test } from "bun:test";
import { createDesktopClipboardSys } from "./index.ts";
import type { RunCommandRequest } from "../run.ts";

describe("createDesktopClipboardSys", () => {
  test("linux prefers xclip when wl tools absent", async () => {
    const calls: RunCommandRequest[] = [];
    const sys = createDesktopClipboardSys({
      platform: "linux",
      run: async (req) => {
        calls.push(req);
        if (req.cmd === "which") {
          const name = req.args?.[0];
          return {
            code: name === "xclip" ? 0 : 1,
            stdout: "",
            stderr: "",
          };
        }
        if (req.cmd === "xclip" && req.args?.includes("-o")) {
          return { code: 0, stdout: "from-clip", stderr: "" };
        }
        if (req.cmd === "xclip") {
          return { code: 0, stdout: "", stderr: "" };
        }
        return { code: 1, stdout: "", stderr: "no" };
      },
    });

    await sys.writeText("hello");
    expect(calls.some((c) => c.cmd === "xclip" && c.stdin === "hello")).toBe(
      true,
    );

    const text = await sys.readText();
    expect(text).toBe("from-clip");
  });

  test("macos uses pbcopy / pbpaste", async () => {
    const calls: RunCommandRequest[] = [];
    const sys = createDesktopClipboardSys({
      platform: "macos",
      run: async (req) => {
        calls.push(req);
        if (req.cmd === "pbpaste") {
          return { code: 0, stdout: "mac-text", stderr: "" };
        }
        return { code: 0, stdout: "", stderr: "" };
      },
    });

    await sys.writeText("x");
    expect(calls.some((c) => c.cmd === "pbcopy" && c.stdin === "x")).toBe(true);
    expect(await sys.readText()).toBe("mac-text");
  });

  test("injected backend wins", async () => {
    let store = "seed";
    const sys = createDesktopClipboardSys({
      platform: "linux",
      backend: {
        platform: "linux",
        async readText() {
          return store;
        },
        async writeText(t) {
          store = t;
        },
      },
    });
    await sys.writeText("next");
    expect(await sys.readText()).toBe("next");
  });
});
