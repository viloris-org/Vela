import { SystemsError } from "../errors.ts";
import { commandExists, type RunCommand } from "../run.ts";
import type {
  ClipboardBackend,
  CreateClipboardBackendOptions,
} from "./types.ts";

type LinuxTool =
  | { kind: "wl"; copy: "wl-copy"; paste: "wl-paste" }
  | { kind: "xclip" }
  | { kind: "xsel" };

async function probeTool(run: RunCommand): Promise<LinuxTool | null> {
  const wayland = Boolean(process.env["WAYLAND_DISPLAY"]);
  if (wayland && (await commandExists("wl-copy", run)) && (await commandExists("wl-paste", run))) {
    return { kind: "wl", copy: "wl-copy", paste: "wl-paste" };
  }
  if (await commandExists("xclip", run)) {
    return { kind: "xclip" };
  }
  if (await commandExists("xsel", run)) {
    return { kind: "xsel" };
  }
  // Prefer wl tools even on X11 if present (some hybrid sessions).
  if ((await commandExists("wl-copy", run)) && (await commandExists("wl-paste", run))) {
    return { kind: "wl", copy: "wl-copy", paste: "wl-paste" };
  }
  return null;
}

/**
 * Linux clipboard via wl-copy/wl-paste, xclip, or xsel (whichever is available).
 */
export function createLinuxClipboardBackend(
  options: CreateClipboardBackendOptions,
): ClipboardBackend {
  const run = options.run;
  let toolPromise: Promise<LinuxTool | null> | undefined;

  async function tool(): Promise<LinuxTool> {
    toolPromise ??= probeTool(run);
    const t = await toolPromise;
    if (t === null) {
      throw new SystemsError(
        "backend_missing",
        "clipboard: need wl-copy/wl-paste, xclip, or xsel on PATH",
        { platform: "linux", feature: "clipboard" },
      );
    }
    return t;
  }

  return {
    platform: "linux",

    async readText() {
      const t = await tool();
      let result;
      if (t.kind === "wl") {
        result = await run({ cmd: t.paste, args: ["--no-newline"], timeoutMs: 10_000 });
        // wl-paste --no-newline may be unsupported; retry plain.
        if (result.code !== 0) {
          result = await run({ cmd: t.paste, timeoutMs: 10_000 });
        }
      } else if (t.kind === "xclip") {
        result = await run({
          cmd: "xclip",
          args: ["-selection", "clipboard", "-o"],
          timeoutMs: 10_000,
        });
      } else {
        result = await run({
          cmd: "xsel",
          args: ["--clipboard", "--output"],
          timeoutMs: 10_000,
        });
      }
      if (result.code !== 0) {
        // Empty clipboard often exits 0; non-zero is a real failure.
        throw new SystemsError(
          "backend_failed",
          `clipboard read failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "linux", feature: "clipboard" },
        );
      }
      return result.stdout;
    },

    async writeText(text) {
      const t = await tool();
      let result;
      if (t.kind === "wl") {
        result = await run({
          cmd: t.copy,
          stdin: text,
          timeoutMs: 10_000,
        });
      } else if (t.kind === "xclip") {
        result = await run({
          cmd: "xclip",
          args: ["-selection", "clipboard"],
          stdin: text,
          timeoutMs: 10_000,
        });
      } else {
        result = await run({
          cmd: "xsel",
          args: ["--clipboard", "--input"],
          stdin: text,
          timeoutMs: 10_000,
        });
      }
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `clipboard write failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "linux", feature: "clipboard" },
        );
      }
    },
  };
}
