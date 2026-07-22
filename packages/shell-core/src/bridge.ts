import type {
  Region,
  VelaPreloadBridge,
  WebShapeUpdate,
} from "@vela/api";
import { capabilityDenied } from "./errors.ts";
import type { ShellCore } from "./shell-core.ts";

export type CreatePreloadBridgeOptions = {
  readonly version?: string;
};

/**
 * In-process adapter implementing VelaPreloadBridge against ShellCore.
 * Phase 1: call is deny-all; no Node/FFI escape.
 */
export function createPreloadBridge(
  core: ShellCore,
  options: CreatePreloadBridgeOptions = {},
): VelaPreloadBridge {
  const version = options.version ?? "0.0.1-shell-core";

  return {
    version,

    async call(method: string, _args?: unknown): Promise<unknown> {
      throw capabilityDenied(method);
    },

    layers: {
      async insert(spec) {
        const layer = core.insertLayer(spec);
        return { id: layer.id };
      },
      async update(id, patch) {
        core.updateLayer(id, patch);
      },
      async remove(id) {
        core.removeLayer(id);
      },
    },

    hit: {
      setOpaqueRegions(update: WebShapeUpdate): void {
        core.setOpaqueRegions(update);
      },
      setMainOpaqueRegions(region: Region): void {
        core.setMainOpaqueRegions(region);
      },
    },

    events: {
      subscribe(channel, handler) {
        return core.subscribe(channel, handler);
      },
    },
  };
}
