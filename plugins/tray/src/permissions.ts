import {
  BuiltinPermissions,
  defineCapability,
  type CapabilityDefinition,
} from "@vela/api";

export const trayPermissionDefs: readonly CapabilityDefinition[] = [
  {
    id: BuiltinPermissions.TrayManage,
    description: "Create, update, and remove system tray icons and menus",
    risk: "low",
    platforms: ["macos", "windows", "linux"],
  },
];

export function registerTrayPermissions(): void {
  for (const def of trayPermissionDefs) {
    try {
      defineCapability(def);
    } catch {
      // already registered via registerBuiltinCapabilities
    }
  }
}

export { BuiltinPermissions as TrayPermissions };
