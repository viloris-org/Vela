import { SystemsError } from "../errors.ts";
import type {
  ClipboardBackend,
  CreateClipboardBackendOptions,
} from "./types.ts";

/**
 * macOS clipboard via `pbpaste` / `pbcopy`.
 */
export function createMacosClipboardBackend(
  options: CreateClipboardBackendOptions,
): ClipboardBackend {
  const run = options.run;

  return {
    platform: "macos",

    async readText() {
      const result = await run({ cmd: "pbpaste", timeoutMs: 10_000 });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `pbpaste failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "macos", feature: "clipboard" },
        );
      }
      return result.stdout;
    },

    async writeText(text) {
      const result = await run({
        cmd: "pbcopy",
        stdin: text,
        timeoutMs: 10_000,
      });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `pbcopy failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "macos", feature: "clipboard" },
        );
      }
    },
  };
}
