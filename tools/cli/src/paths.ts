import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

/** Desktop composition Shell platforms (matches sys-desktop naming). */
export type ShellPlatform = "linux" | "macos" | "windows";

/** Monorepo root: tools/cli/src → ../../../ */
export function repoRoot(): string {
  return resolve(import.meta.dir, "../../..");
}

/**
 * Map Bun/Node `process.platform` to a Shell host family.
 * Returns `null` for non-desktop (unlikely on CLI hosts).
 */
export function detectShellPlatform(
  nodePlatform: NodeJS.Platform = process.platform,
): ShellPlatform | null {
  switch (nodePlatform) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return null;
  }
}

export function parseShellPlatform(value: string): ShellPlatform | "auto" {
  const v = value.toLowerCase();
  if (v === "auto") return "auto";
  if (v === "linux" || v === "macos" || v === "windows") return v;
  throw new Error(
    `--platform expects auto|linux|macos|windows, got ${value}`,
  );
}

export function resolveShellPlatform(
  explicit: ShellPlatform | "auto" | undefined,
  nodePlatform: NodeJS.Platform = process.platform,
): ShellPlatform {
  if (explicit && explicit !== "auto") return explicit;
  const detected = detectShellPlatform(nodePlatform);
  if (!detected) {
    throw new Error(
      `Cannot detect Shell platform from process.platform=${nodePlatform}; pass --platform linux|macos|windows`,
    );
  }
  return detected;
}

export function linuxShellDir(root = repoRoot()): string {
  return join(root, "hosts", "linux-shell");
}

export function desktopShellDir(root = repoRoot()): string {
  return join(root, "hosts", "desktop-shell");
}

export function windowsShellDir(root = repoRoot()): string {
  return join(root, "hosts", "windows-shell");
}

export function shellDir(platform: ShellPlatform, root = repoRoot()): string {
  switch (platform) {
    case "linux":
      return linuxShellDir(root);
    case "macos":
      return desktopShellDir(root);
    case "windows":
      return windowsShellDir(root);
  }
}

/**
 * Default Shell binary path for a platform.
 * Paths match host README build outputs once those hosts exist.
 */
export function defaultShellBinary(
  platform: ShellPlatform = "linux",
  root = repoRoot(),
): string {
  switch (platform) {
    case "linux":
      return join(linuxShellDir(root), "zig-out", "bin", "vela-linux-shell");
    case "macos":
      // swift build -c release --product vela-desktop-shell
      return join(
        desktopShellDir(root),
        ".build",
        "release",
        "vela-desktop-shell",
      );
    case "windows":
      return join(
        windowsShellDir(root),
        "build",
        "Release",
        "vela-windows-shell.exe",
      );
  }
}

export function shellBinaryExists(path: string): boolean {
  return existsSync(path);
}

/** Human-facing install / build hint when the binary is missing. */
export function shellMissingHint(platform: ShellPlatform, binary: string): string {
  switch (platform) {
    case "linux":
      return (
        `Shell binary not found: ${binary}\n` +
        `  Install Zig 0.16.x + gtk4-devel + webkitgtk6.0-devel, then:\n` +
        `  cd hosts/linux-shell && zig build\n` +
        `  Or omit --no-build so \`vela dev\` builds automatically.\n` +
        `  Fallback: \`vela dev --browser\` (mock window.vela).`
      );
    case "macos":
      return (
        `Shell binary not found: ${binary}\n` +
        `  Requires macOS + Xcode / Swift 5.9+.\n` +
        `  cd hosts/desktop-shell && swift build -c release --product vela-desktop-shell\n` +
        `  See hosts/desktop-shell/README.md.\n` +
        `  Fallback: \`vela dev --browser\` (mock window.vela).`
      );
    case "windows":
      return (
        `Shell binary not found: ${binary}\n` +
        `  Windows composition host is scaffolded (Phase 4); no runnable MVP yet.\n` +
        `  See hosts/windows-shell/README.md (C++/WinRT + WebView2).\n` +
        `  Fallback: \`vela dev --browser\` (mock window.vela).`
      );
  }
}
