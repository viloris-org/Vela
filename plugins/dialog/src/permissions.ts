import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

/** Catalog entries owned by this plugin (idempotent with builtins). */
export const dialogPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.DialogOpen,
    description: "Open file / folder picker dialogs",
    risk: "medium",
    platforms: ["macos", "windows", "linux"],
  },
  {
    id: BuiltinPermissions.DialogSave,
    description: "Save file dialogs",
    risk: "medium",
    platforms: ["macos", "windows", "linux"],
  },
];

export function registerDialogPermissions(): void {
  for (const def of dialogPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as DialogPermissions };
