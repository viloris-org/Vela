import { SystemsError } from "../errors.ts";
import type {
  CreateShellBackendOptions,
  ShellBackend,
} from "./types.ts";

/**
 * Windows open-external via `cmd /c start` with empty title so the URL is not
 * misinterpreted as a window title.
 */
export function createWindowsShellBackend(
  options: CreateShellBackendOptions,
): ShellBackend {
  const run = options.run;

  return {
    platform: "windows",

    async openExternal(url) {
      // `start "" <url>` — empty title required when the first arg is quoted.
      const result = await run({
        cmd: "cmd.exe",
        args: ["/c", "start", "", url],
        timeoutMs: 15_000,
      });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `shell.openExternal failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`}`,
          { platform: "windows", feature: "shell" },
        );
      }
    },
  };
}
