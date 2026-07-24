import { SystemsError } from "../errors.ts";
import type {
  CreateShellBackendOptions,
  ShellBackend,
} from "./types.ts";

/**
 * macOS open-external via `/usr/bin/open`.
 */
export function createMacosShellBackend(
  options: CreateShellBackendOptions,
): ShellBackend {
  const run = options.run;

  return {
    platform: "macos",

    async openExternal(url) {
      const result = await run({
        cmd: "open",
        args: [url],
        timeoutMs: 15_000,
      });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `shell.openExternal failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`}`,
          { platform: "macos", feature: "shell" },
        );
      }
    },
  };
}
