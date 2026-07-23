/**
 * Capability model: default-deny permissions for system APIs.
 * Manifest grants capabilities to windows / preload profiles.
 */

export type PermissionId = string;

/** Well-known permission ids (non-exhaustive; plugins may add more). */
export const BuiltinPermissions = {
  FsAppRead: "fs:app-read",
  FsAppWrite: "fs:app-write",
  ClipboardRead: "clipboard:read",
  ClipboardWrite: "clipboard:write",
  NotifyShow: "notify:show",
  /** Create / update / remove system tray icons and menus. */
  TrayManage: "tray:manage",
  DialogOpen: "dialog:open",
  DialogSave: "dialog:save",
  WindowMaterial: "window:material",
  CameraPreview: "camera:preview",
  CameraCapture: "camera:capture",
  NativeLoadUnsigned: "native:load-unsigned",
  ShellOpenExternal: "shell:open-external",
} as const;

export type BuiltinPermissionId =
  (typeof BuiltinPermissions)[keyof typeof BuiltinPermissions];

export interface CapabilityGrant {
  readonly permissions: readonly PermissionId[];
  /** Optional path / URL patterns for scoped fs/http. */
  readonly scopes?: readonly CapabilityScope[];
}

export type CapabilityScope =
  | { readonly type: "path"; readonly pattern: string }
  | { readonly type: "url"; readonly pattern: string };

export interface AppManifestCapabilities {
  readonly [profileName: string]: CapabilityGrant;
}

export interface CapabilityCheckRequest {
  readonly permission: PermissionId;
  readonly profile?: string;
  readonly resource?: string;
}

export interface CapabilityCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface CapabilityDefinition {
  readonly id: PermissionId;
  readonly description: string;
  /** Platforms that implement this permission. Empty = all. */
  readonly platforms?: readonly string[];
  readonly risk: "low" | "medium" | "high" | "critical";
}
