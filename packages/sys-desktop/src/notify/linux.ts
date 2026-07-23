import { SystemsError } from "../errors.ts";
import type { CreateNotifyBackendOptions, NotifyBackend } from "./types.ts";

/**
 * Parse notification id from `notify-send --print-id` stdout.
 * Output is typically a single integer line.
 */
function parsePrintedId(stdout: string): number | null {
  const m = stdout.trim().match(/^(\d+)\s*$/m);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Linux notifications via `notify-send` (libnotify).
 *
 * When `--print-id` is available, stores string id → daemon id for replace/close.
 * Falls back to best-effort show without replace/close mapping on older tools.
 *
 * Note: CLI path is show/close only — action/click events are not emitted.
 */
export function createLinuxNotifyBackend(
  options: CreateNotifyBackendOptions,
): NotifyBackend {
  const run = options.run;
  const appName = options.appName ?? "Vela";
  /** App string id → notification-daemon numeric id (from --print-id). */
  const daemonIds = new Map<string, number>();

  async function showOnce(
    opts: Parameters<NotifyBackend["show"]>[0],
    useReplace: boolean,
    usePrintId: boolean,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const args: string[] = ["--app-name", appName];
    if (usePrintId) {
      args.push("--print-id");
    }
    if (useReplace) {
      const replaceId = daemonIds.get(opts.id);
      if (replaceId !== undefined) {
        args.push("--replace-id", String(replaceId));
      }
    }
    if (opts.icon) {
      args.push("--icon", opts.icon);
    }
    if (opts.silent) {
      args.push("--hint", "int:suppress-sound:1");
    }
    args.push(opts.title, opts.body ?? "");
    return await run({ cmd: "notify-send", args, timeoutMs: 10_000 });
  }

  function unsupportedFlag(stderr: string, flag: string): boolean {
    const s = stderr.toLowerCase();
    return s.includes(flag) || s.includes("unrecognized") || s.includes("unknown option");
  }

  return {
    platform: "linux",

    async show(opts) {
      // Prefer print-id so replace/close use the daemon-assigned id.
      let result = await showOnce(opts, true, true);

      if (result.code !== 0 && unsupportedFlag(result.stderr, "print-id")) {
        // Older notify-send: no --print-id; still try replace if we have a map entry.
        result = await showOnce(opts, true, false);
        if (result.code !== 0 && unsupportedFlag(result.stderr, "replace-id")) {
          result = await showOnce(opts, false, false);
        }
        if (result.code !== 0) {
          throw new SystemsError(
            "backend_failed",
            `notify-send failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
            { platform: "linux", feature: "notify" },
          );
        }
        return { id: opts.id };
      }

      if (result.code !== 0 && unsupportedFlag(result.stderr, "replace-id")) {
        // print-id ok, replace-id not — retry without replace.
        result = await showOnce(opts, false, true);
      }

      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `notify-send failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "linux", feature: "notify" },
        );
      }

      const printed = parsePrintedId(result.stdout);
      if (printed !== null) {
        daemonIds.set(opts.id, printed);
      }
      return { id: opts.id };
    },

    async close(id) {
      const nid = daemonIds.get(id);
      if (nid === undefined) {
        // Never showed (or print-id unavailable) — nothing reliable to close.
        return;
      }
      const result = await run({
        cmd: "gdbus",
        args: [
          "call",
          "--session",
          "--dest",
          "org.freedesktop.Notifications",
          "--object-path",
          "/org/freedesktop/Notifications",
          "--method",
          "org.freedesktop.Notifications.CloseNotification",
          String(nid),
        ],
        timeoutMs: 5_000,
      });
      if (result.code === 0) {
        daemonIds.delete(id);
      }
      // close remains best-effort on Linux CLI path
    },
  };
}
