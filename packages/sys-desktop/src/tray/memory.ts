import type {
  HostEventBus,
  TrayCreateOptions,
  TrayCreateResult,
  TrayMenuItem,
  TrayUpdateOptions,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import type { DesktopPlatform } from "../platform.ts";
import type { TrayBackend } from "./types.ts";

type TrayState = {
  id: string;
  tooltip?: string;
  icon?: string;
  menu?: readonly TrayMenuItem[];
};

/** In-process tray (tests / CI without GUI helpers). */
export function createMemoryTrayBackend(
  platform: DesktopPlatform,
  _events?: HostEventBus,
): TrayBackend {
  const trays = new Map<string, TrayState>();

  return {
    platform,
    async create(options: TrayCreateOptions & { id: string }): Promise<TrayCreateResult> {
      if (trays.has(options.id)) {
        throw new SystemsError(
          "invalid_state",
          `tray already exists: ${options.id}`,
          { platform, feature: "tray" },
        );
      }
      const state: TrayState = { id: options.id };
      if (options.tooltip !== undefined) state.tooltip = options.tooltip;
      if (options.icon !== undefined) state.icon = options.icon;
      if (options.menu !== undefined) state.menu = options.menu;
      trays.set(options.id, state);
      return { id: options.id };
    },
    async update(id: string, patch: Omit<TrayUpdateOptions, "id">) {
      const existing = trays.get(id);
      if (!existing) {
        throw new SystemsError("invalid_state", `unknown tray: ${id}`, {
          platform,
          feature: "tray",
        });
      }
      if (patch.tooltip !== undefined) existing.tooltip = patch.tooltip;
      if (patch.icon !== undefined) existing.icon = patch.icon;
      if (patch.menu !== undefined) existing.menu = patch.menu;
    },
    async remove(id: string) {
      if (!trays.delete(id)) {
        throw new SystemsError("invalid_state", `unknown tray: ${id}`, {
          platform,
          feature: "tray",
        });
      }
    },
  };
}
