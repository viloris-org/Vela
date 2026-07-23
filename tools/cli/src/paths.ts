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

export type AppSpec = {
  id: "clock" | "playground";
  filter: string;
  defaultPort: number;
  envPortKey: string;
};

export const APPS: Record<"clock" | "playground", AppSpec> = {
  clock: {
    id: "clock",
    filter: "@vela/example-clock",
    defaultPort: 5174,
    envPortKey: "CLOCK_PORT",
  },
  playground: {
    id: "playground",
    filter: "@vela/playground",
    defaultPort: 5173,
    envPortKey: "PLAYGROUND_PORT",
  },
};
