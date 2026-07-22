import type { InsertLayerSpec } from "../layer/types.ts";
import { BuiltinPermissions, type PermissionId } from "./types.ts";

/**
 * Well-known native component → permission ids (host may extend via lookup).
 * Unknown components return [] so the host can attach component-registry permissions.
 */
const WELL_KNOWN_NATIVE_PERMISSIONS: Readonly<
  Record<string, readonly PermissionId[]>
> = {
  "camera.preview": [BuiltinPermissions.CameraPreview],
  "camera.capture": [BuiltinPermissions.CameraCapture],
};

/**
 * Permissions required to insert a layer of this kind / component.
 * Empty array means no capability gate in the contract (still subject to host policy).
 */
export function permissionsForInsertLayer(
  spec: InsertLayerSpec,
  resolveNativePermissions?: (
    component: string,
  ) => readonly PermissionId[] | undefined,
): readonly PermissionId[] {
  switch (spec.kind) {
    case "material":
      return [BuiltinPermissions.WindowMaterial];
    case "native": {
      const fromLookup = resolveNativePermissions?.(spec.component);
      if (fromLookup !== undefined) {
        return fromLookup;
      }
      return WELL_KNOWN_NATIVE_PERMISSIONS[spec.component] ?? [];
    }
    case "webview":
    case "chrome":
    case "passthrough":
      return [];
  }
}

/**
 * True when every permission required by the insert is present on the grant
 * (scope checks are not applied to layer inserts — resource is the layer itself).
 */
export function insertLayerPermissionsGranted(
  granted: readonly PermissionId[] | undefined,
  required: readonly PermissionId[],
): boolean {
  if (required.length === 0) {
    return true;
  }
  if (granted === undefined) {
    return false;
  }
  return required.every((p) => granted.includes(p));
}
