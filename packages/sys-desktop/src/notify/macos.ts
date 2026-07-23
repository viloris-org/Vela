import { SystemsError } from "../errors.ts";
import { escapeAppleScript } from "../escape.ts";
import type { CreateNotifyBackendOptions, NotifyBackend } from "./types.ts";

/**
 * macOS notifications via `osascript` / `display notification`.
 * Close is a no-op (Notification Center does not expose a simple CLI dismiss).
 */
export function createMacosNotifyBackend(
  options: CreateNotifyBackendOptions,
): NotifyBackend {
  const run = options.run;

  return {
    platform: "macos",

    async show(opts) {
      const title = escapeAppleScript(opts.title);
      const body = escapeAppleScript(opts.body ?? "");
      let script = `display notification "${body}" with title "${title}"`;
      if (!opts.silent) {
        script += ` sound name "default"`;
      }

      const result = await run({
        cmd: "osascript",
        args: ["-e", script],
        timeoutMs: 10_000,
      });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `osascript notification failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "macos", feature: "notify" },
        );
      }
      return { id: opts.id };
    },

    async close(_id) {
      // No portable CLI to dismiss Notification Center items.
    },
  };
}
