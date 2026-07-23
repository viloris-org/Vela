import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

/** Monorepo root: tools/cli/src → ../../../ */
export function repoRoot(): string {
  return resolve(import.meta.dir, "../../..");
}

export function linuxShellDir(root = repoRoot()): string {
  return join(root, "hosts", "linux-shell");
}

export function defaultShellBinary(root = repoRoot()): string {
  return join(linuxShellDir(root), "zig-out", "bin", "vela-linux-shell");
}

export function shellBinaryExists(path: string): boolean {
  return existsSync(path);
}
