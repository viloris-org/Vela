import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

/** Catalog entries owned by this plugin (idempotent with builtins). */
export const shellPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.ShellOpenExternal,
    description: "Open URLs / paths with the system handler",
    risk: "high",
  },
];

export function registerShellPermissions(): void {
  for (const def of shellPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as ShellPermissions };
