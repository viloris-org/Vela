import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

/** Catalog entries owned by this plugin (idempotent with builtins). */
export const fsPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.FsAppRead,
    description: "Read files under the app data sandbox",
    risk: "medium",
  },
  {
    id: BuiltinPermissions.FsAppWrite,
    description: "Write files under the app data sandbox",
    risk: "medium",
  },
];

export function registerFsPermissions(): void {
  for (const def of fsPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as FsPermissions };
