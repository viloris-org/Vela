import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to packages/sys-desktop (helpers live here). */
export function sysDesktopPackageRoot(): string {
  // src/paths.ts → package root
  return fileURLToPath(new URL("..", import.meta.url));
}

export function helperPath(
  name: "tray-linux.py" | "tray-macos.swift" | "tray-windows.ps1",
): string {
  return join(sysDesktopPackageRoot(), "helpers", name);
}
