import type { PlatformId } from "@vela/api";

/** Desktop targets for notify/tray systems facades. */
export type DesktopPlatform = "linux" | "macos" | "windows";

export function isDesktopPlatform(
  platform: PlatformId | string,
): platform is DesktopPlatform {
  return (
    platform === "linux" || platform === "macos" || platform === "windows"
  );
}

/**
 * Map Bun/Node `process.platform` to Vela desktop id.
 * Returns `unknown` for non-desktop (mobile / exotic).
 */
export function detectDesktopPlatform(
  nodePlatform: NodeJS.Platform = process.platform,
): DesktopPlatform | "unknown" {
  switch (nodePlatform) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}

export function requireDesktopPlatform(
  platform: PlatformId | DesktopPlatform | "unknown",
  feature: string,
): DesktopPlatform {
  if (isDesktopPlatform(platform)) {
    return platform;
  }
  throw new Error(
    `${feature}: requires desktop platform (linux|macos|windows), got ${platform}`,
  );
}
