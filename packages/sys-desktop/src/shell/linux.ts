import { SystemsError } from "../errors.ts";
import type {
  CreateShellBackendOptions,
  ShellBackend,
} from "./types.ts";

/**
 * Linux open-external via `xdg-open` (desktop file associations).
 */
export function createLinuxShellBackend(
  options: CreateShellBackendOptions,
): ShellBackend {
  const run = options.run;

  return {
    platform: "linux",

    async openExternal(url) {
      const result = await run({
        cmd: "xdg-open",
        args: [url],
        timeoutMs: 15_000,
      });
      // Some desktops return non-zero even when the browser launched; only
      // treat clear spawn failures as hard errors when stderr is informative.
      if (result.code !== 0 && result.stderr.trim().length > 0) {
        throw new SystemsError(
          "backend_failed",
          `shell.openExternal failed: ${result.stderr.trim() || `exit ${result.code}`}`,
          { platform: "linux", feature: "shell" },
        );
      }
      if (result.code !== 0) {
        // xdg-open often exits 0; if non-zero with empty stderr, still fail closed.
        throw new SystemsError(
          "backend_failed",
          `shell.openExternal: xdg-open exit ${result.code}`,
          { platform: "linux", feature: "shell" },
        );
      }
    },
  };
}
