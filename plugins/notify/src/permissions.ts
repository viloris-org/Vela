import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

/** Catalog entries owned by this plugin (idempotent with builtins). */
export const notifyPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.NotifyShow,
    description: "Show and dismiss user notifications",
    risk: "low",
  },
];

export function registerNotifyPermissions(): void {
  for (const def of notifyPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as NotifyPermissions };
