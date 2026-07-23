import type {
  HostEventBus,
  HostSystemsFacade,
  TrayCreateOptions,
  TrayCreateResult,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import {
  detectDesktopPlatform,
  type DesktopPlatform,
  isDesktopPlatform,
} from "../platform.ts";
import { defaultRunCommand, type RunCommand } from "../run.ts";
import { createHelperTrayBackend } from "./helper-backend.ts";
import { createMemoryTrayBackend } from "./memory.ts";
import type { TrayBackend } from "./types.ts";

export type CreateDesktopTraySysOptions = {
  readonly platform?: DesktopPlatform | "auto";
  readonly run?: RunCommand;
  readonly events?: HostEventBus;
  readonly idPrefix?: string;
  /**
   * `helper` — real OS tray via platform helper (default).
   * `memory` — in-process only (tests / headless CI).
   */
  readonly mode?: "helper" | "memory";
  readonly helperPath?: string;
  readonly backend?: TrayBackend;
};

function createBackend(
  platform: DesktopPlatform,
  options: CreateDesktopTraySysOptions,
  run: RunCommand,
): TrayBackend {
  if (options.backend) return options.backend;
  if (options.mode === "memory") {
    return createMemoryTrayBackend(platform, options.events);
  }
  return createHelperTrayBackend({
    platform,
    run,
    ...(options.events !== undefined ? { events: options.events } : {}),
    ...(options.helperPath !== undefined
      ? { helperPath: options.helperPath }
      : {}),
  });
}

export type DesktopTraySys = NonNullable<HostSystemsFacade["tray"]> & {
  /** Shut down helper process if any. */
  dispose(): Promise<void>;
};

/**
 * Real desktop `HostSystemsFacade.tray` for linux / macos / windows.
 * Default mode spawns a small platform helper (Python/Swift/PowerShell).
 */
export function createDesktopTraySys(
  options: CreateDesktopTraySysOptions = {},
): DesktopTraySys {
  const resolved =
    options.platform === undefined || options.platform === "auto"
      ? detectDesktopPlatform()
      : options.platform;

  if (!isDesktopPlatform(resolved)) {
    throw new SystemsError(
      "unsupported",
      `tray systems facade requires desktop platform, got ${resolved}`,
      { feature: "tray", platform: String(resolved) },
    );
  }

  const run = options.run ?? defaultRunCommand;
  const backend = createBackend(resolved, options, run);
  let seq = 0;
  const prefix = options.idPrefix ?? "tray";

  return {
    async create(opts: TrayCreateOptions = {}): Promise<TrayCreateResult> {
      const id = opts.id ?? `${prefix}-${++seq}`;
      return await backend.create({ ...opts, id });
    },
    async update(id, patch) {
      await backend.update(id, patch);
    },
    async remove(id) {
      await backend.remove(id);
    },
    async dispose() {
      await backend.dispose?.();
    },
  };
}

export type { TrayBackend } from "./types.ts";
export { createMemoryTrayBackend } from "./memory.ts";
export { createHelperTrayBackend } from "./helper-backend.ts";
