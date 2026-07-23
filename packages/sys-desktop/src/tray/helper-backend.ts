import type {
  TrayCreateOptions,
  TrayCreateResult,
  TrayUpdateOptions,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import { helperPath } from "../paths.ts";
import type { DesktopPlatform } from "../platform.ts";
import { TrayHelperProcess, type HelperSpawnSpec } from "./helper-process.ts";
import type { CreateTrayBackendOptions, TrayBackend } from "./types.ts";

function spawnSpecFor(
  platform: DesktopPlatform,
  overridePath?: string,
): HelperSpawnSpec {
  switch (platform) {
    case "linux":
      return {
        cmd: "python3",
        args: [overridePath ?? helperPath("tray-linux.py")],
      };
    case "macos":
      return {
        cmd: "swift",
        args: [overridePath ?? helperPath("tray-macos.swift")],
      };
    case "windows":
      return {
        cmd: "powershell.exe",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          overridePath ?? helperPath("tray-windows.ps1"),
        ],
      };
  }
}

/**
 * Tray backend that drives a platform helper process (real OS icon + menu).
 *
 * Note: `options.run` is accepted for API symmetry with notify/dialog but is
 * not used here — helpers are long-lived processes spawned via `Bun.spawn`.
 * Inject `mode: "memory"` or a custom `backend` for tests without a helper.
 */
export function createHelperTrayBackend(
  options: CreateTrayBackendOptions,
): TrayBackend {
  const platform = options.platform;
  const helper = new TrayHelperProcess(
    platform,
    spawnSpecFor(platform, options.helperPath),
    options.events,
  );
  const known = new Set<string>();

  return {
    platform,

    async create(opts: TrayCreateOptions & { id: string }): Promise<TrayCreateResult> {
      if (known.has(opts.id)) {
        throw new SystemsError(
          "invalid_state",
          `tray already exists: ${opts.id}`,
          { platform, feature: "tray" },
        );
      }
      try {
        await helper.request({
          op: "create",
          trayId: opts.id,
          ...(opts.tooltip !== undefined ? { tooltip: opts.tooltip } : {}),
          ...(opts.icon !== undefined ? { icon: opts.icon } : {}),
          ...(opts.menu !== undefined ? { menu: opts.menu } : {}),
        });
      } catch (err) {
        if (err instanceof SystemsError) throw err;
        throw new SystemsError(
          "backend_failed",
          err instanceof Error ? err.message : String(err),
          { platform, feature: "tray", cause: err },
        );
      }
      known.add(opts.id);
      return { id: opts.id };
    },

    async update(id: string, patch: Omit<TrayUpdateOptions, "id">) {
      if (!known.has(id)) {
        throw new SystemsError("invalid_state", `unknown tray: ${id}`, {
          platform,
          feature: "tray",
        });
      }
      await helper.request({
        op: "update",
        trayId: id,
        ...(patch.tooltip !== undefined ? { tooltip: patch.tooltip } : {}),
        ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
        ...(patch.menu !== undefined ? { menu: patch.menu } : {}),
      });
    },

    async remove(id: string) {
      if (!known.has(id)) {
        throw new SystemsError("invalid_state", `unknown tray: ${id}`, {
          platform,
          feature: "tray",
        });
      }
      await helper.request({ op: "remove", trayId: id });
      known.delete(id);
      if (known.size === 0) {
        await helper.dispose();
      }
    },

    async dispose() {
      known.clear();
      await helper.dispose();
    },
  };
}
