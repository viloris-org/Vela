import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as readline from "node:readline";
import {
  VELA_PACKAGE_MARKER,
  parseVelaPackage,
  type VelaPackage,
} from "../../../packages/api/src/project/package.ts";
import {
  DEFAULT_PACKAGE_PARENTS,
  VELA_WORKSPACE_MARKER,
  defaultVelaWorkspace,
  parseVelaWorkspace,
  type VelaWorkspace,
} from "../../../packages/api/src/project/workspace.ts";
import { repoRoot } from "./paths";

/** Resolved content process for `vela dev` (workspace package or --dir). */
export type ContentTarget = {
  kind: "workspace" | "external";
  id: string;
  dir: string;
  defaultPort: number;
  envPortKey: string;
  script: string;
  label: string;
};

export function workspaceTargetFromDemo(demo: DiscoveredDemo): ContentTarget {
  return {
    kind: "workspace",
    id: demo.id,
    dir: demo.dir,
    defaultPort: demo.defaultPort,
    envPortKey: demo.envPortKey,
    script: demo.script,
    label: demo.id,
  };
}

/**
 * External package at `--dir`: must be a valid App package root (`vela.json`).
 * Optional `--script` overrides `vela.json` dev.script.
 */
export function resolveExternalTarget(
  dirArg: string,
  scriptOverride?: string,
): ContentTarget {
  const dir = resolve(dirArg);
  if (!existsSync(dir)) {
    throw new Error(`External project directory not found: ${dir}`);
  }
  const demo = loadPackageRoot(dir, { relDir: dir });
  const script = scriptOverride?.trim() || demo.script;
  return {
    kind: "external",
    id: demo.id,
    dir: demo.dir,
    script,
    defaultPort: demo.defaultPort,
    envPortKey: demo.envPortKey,
    label: demo.dir,
  };
}

/** Port env keys injected so serve scripts can bind correctly. */
export function contentPortEnv(port: number, target: ContentTarget): Record<string, string> {
  return {
    PORT: String(port),
    VELA_PORT: String(port),
    [target.envPortKey]: String(port),
  };
}

/** Fallback port when `vela.json` has no `dev.port`. */
export const DEMO_DEFAULT_PORT = 5173;

export type DiscoveredDemo = {
  /** Short selector id (`--app <id>`). From `vela.json` id. */
  id: string;
  /** Display name. */
  name: string;
  /** package.json `name` when present (informational). */
  packageName?: string;
  /** Absolute package directory (contains vela.json). */
  dir: string;
  /** Path relative to monorepo root (or abs label for external). */
  relDir: string;
  defaultPort: number;
  /** package.json script for instant serve. */
  script: string;
  /** e.g. clock → CLOCK_PORT. */
  envPortKey: string;
  /** Parsed package descriptor. */
  vela: VelaPackage;
};

function envPortKeyForId(id: string): string {
  const slug = id
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${slug || "APP"}_PORT`;
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function listImmediateSubdirs(parent: string): string[] {
  if (!existsSync(parent)) return [];
  return readdirSync(parent)
    .map((name) => join(parent, name))
    .filter((p) => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
}

/** Load monorepo workspace descriptor or defaults. */
export function loadWorkspace(root = repoRoot()): VelaWorkspace {
  const path = join(root, VELA_WORKSPACE_MARKER);
  const raw = readJsonFile(path);
  if (raw === null) return defaultVelaWorkspace();
  const parsed = parseVelaWorkspace(raw);
  if (!parsed.ok) {
    throw new Error(`${VELA_WORKSPACE_MARKER}: ${parsed.error}`);
  }
  return parsed.workspace;
}

/**
 * Walk from `start` upward looking for a directory that contains `vela.json`.
 * Models the real app-author path: run tools from (or under) an independent
 * package root — e.g. `cd example/clock && …` or a sibling repo like Zepyyr.
 *
 * Returns absolute path or null if none found before the filesystem root.
 */
export function findNearestPackageRoot(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, VELA_PACKAGE_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load a single package root (directory that must contain valid vela.json).
 * Used for monorepo children, cwd package roots, and `--dir` projects.
 */
export function loadPackageRoot(
  dir: string,
  opts: { relDir?: string } = {},
): DiscoveredDemo {
  const marker = join(dir, VELA_PACKAGE_MARKER);
  const raw = readJsonFile(marker);
  if (raw === null) {
    throw new Error(
      `Not a Vela App package (missing ${VELA_PACKAGE_MARKER}): ${dir}\n` +
        `  See docs/app-package-layout.md`,
    );
  }
  const parsed = parseVelaPackage(raw);
  if (!parsed.ok) {
    throw new Error(`${marker}: ${parsed.error}`);
  }
  const vela = parsed.package;
  const pkgJson = readJsonFile(join(dir, "package.json")) as {
    name?: string;
  } | null;
  const script = vela.dev?.script?.trim() || "serve";
  const defaultPort =
    typeof vela.dev?.port === "number" && vela.dev.port > 0
      ? vela.dev.port
      : DEMO_DEFAULT_PORT;

  return {
    id: vela.id,
    name: vela.name ?? vela.id,
    packageName: typeof pkgJson?.name === "string" ? pkgJson.name : undefined,
    dir,
    relDir: opts.relDir ?? dir,
    defaultPort,
    script,
    envPortKey: envPortKeyForId(vela.id),
    vela,
  };
}

/**
 * Discover in-repo packages: workspace `packageParents` × one-level children
 * that contain a valid `vela.json`.
 */
export function discoverDemos(root = repoRoot()): DiscoveredDemo[] {
  const workspace = loadWorkspace(root);
  const found: DiscoveredDemo[] = [];

  for (const parentName of workspace.packageParents) {
    const parent = join(root, parentName);
    for (const dir of listImmediateSubdirs(parent)) {
      const marker = join(dir, VELA_PACKAGE_MARKER);
      if (!existsSync(marker)) continue;
      try {
        const demo = loadPackageRoot(dir, {
          relDir: relative(root, dir) || dir,
        });
        found.push(demo);
      } catch (err) {
        console.warn(
          `[vela] skip ${relative(root, dir)}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
  }

  found.sort((a, b) => a.id.localeCompare(b.id) || a.relDir.localeCompare(b.relDir));

  const seen = new Set<string>();
  const unique: DiscoveredDemo[] = [];
  for (const d of found) {
    const key = d.id.toLowerCase();
    if (seen.has(key)) {
      console.warn(`[vela] duplicate package id "${d.id}" at ${d.relDir}; keeping first`);
      continue;
    }
    seen.add(key);
    unique.push(d);
  }

  const usedPorts = new Set<number>();
  for (const d of unique) {
    let p = d.defaultPort;
    while (usedPorts.has(p)) p += 1;
    d.defaultPort = p;
    usedPorts.add(p);
  }

  return unique;
}

/** Match `--app` against id, package name, basename, or 1-based list index. */
export function matchDemo(demos: DiscoveredDemo[], query: string): DiscoveredDemo | undefined {
  const q = query.trim();
  if (!q) return undefined;
  const lower = q.toLowerCase();

  const byId = demos.find((d) => d.id.toLowerCase() === lower);
  if (byId) return byId;

  const byPkg = demos.find((d) => d.packageName?.toLowerCase() === lower);
  if (byPkg) return byPkg;

  const byBase = demos.find((d) => basename(d.dir).toLowerCase() === lower);
  if (byBase) return byBase;

  if (/^\d+$/.test(q)) {
    const n = Number(q);
    if (n >= 1 && n <= demos.length) return demos[n - 1];
  }

  return undefined;
}

export function formatDemoList(demos: DiscoveredDemo[]): string {
  if (demos.length === 0) return "(none)";
  const idW = Math.max(...demos.map((d) => d.id.length), 2);
  const lines = demos.map((d, i) => {
    const n = String(i + 1).padStart(2, " ");
    const id = d.id.padEnd(idW);
    const pkg = d.packageName ?? "-";
    return `  ${n}) ${id}  ${pkg}  :${d.defaultPort}  ${d.relDir}`;
  });
  return lines.join("\n");
}

export async function pickDemo(demos: DiscoveredDemo[]): Promise<DiscoveredDemo> {
  if (demos.length === 0) {
    throw new Error(
      `No Vela App packages found (need ${VELA_PACKAGE_MARKER} under ` +
        `${DEFAULT_PACKAGE_PARENTS.join("/, ")}/).\n` +
        `  See docs/app-package-layout.md — or use --dir / --url.`,
    );
  }
  if (demos.length === 1) return demos[0]!;

  const list = formatDemoList(demos);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `Multiple packages found; pass --app <id> (or number):\n${list}\n` +
        `  Or: --dir <external package root> | --url <url>`,
    );
  }

  console.log(`[vela] Multiple packages found — pick one:`);
  console.log(list);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = await new Promise<string>((resolve) => {
        rl.question(`Choose [1-${demos.length}] (or id): `, resolve);
      });
      const picked = matchDemo(demos, answer.trim());
      if (picked) {
        console.log(`[vela] selected ${picked.id} (${picked.name})`);
        return picked;
      }
      console.log(`[vela] invalid choice: ${answer.trim() || "(empty)"}`);
    }
  } finally {
    rl.close();
  }
}

export async function selectWorkspaceDemo(app?: string): Promise<DiscoveredDemo> {
  const demos = discoverDemos();
  if (app) {
    const hit = matchDemo(demos, app);
    if (!hit) {
      throw new Error(
        `Unknown --app ${JSON.stringify(app)}. Available:\n${formatDemoList(demos)}`,
      );
    }
    return hit;
  }
  return pickDemo(demos);
}
