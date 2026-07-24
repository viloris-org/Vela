import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

/** Catalog entries owned by this plugin (idempotent with builtins). */
export const clipboardPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.ClipboardRead,
    description: "Read the system clipboard",
    risk: "medium",
  },
  {
    id: BuiltinPermissions.ClipboardWrite,
    description: "Write the system clipboard",
    risk: "low",
  },
];

export function registerClipboardPermissions(): void {
  for (const def of clipboardPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as ClipboardPermissions };
