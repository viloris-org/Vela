import { existsSync } from "node:fs";
import type { DevOptions } from "./args";
import {
  contentPortEnv,
  discoverDemos,
  findNearestPackageRoot,
  formatDemoList,
  resolveExternalTarget,
  selectWorkspaceDemo,
  workspaceTargetFromDemo,
  type ContentTarget,
} from "./discover";
import {
  defaultShellBinary,
  resolveShellPlatform,
  shellBinaryExists,
  shellDir,
  shellMissingHint,
  type ShellPlatform,
} from "./paths";
import { installSignalHandlers, killAll, runForeground, track, waitForHttp } from "./process";

function contentUrl(
  opts: DevOptions,
  target: ContentTarget | null,
): { url: string; startServe: boolean; port: number } {
  if (opts.url) {
    return { url: opts.url, startServe: false, port: 0 };
  }
  if (!target) {
    throw new Error("internal: content target required when --url is not set");
  }
  const port = opts.port ?? target.defaultPort;
  return {
    url: `http://127.0.0.1:${port}/`,
    startServe: true,
    port,
  };
}

async function buildShell(platform: ShellPlatform, dir: string): Promise<number> {
  switch (platform) {
    case "linux":
      console.log(`[vela] building linux-shell (zig build)…`);
      return runForeground("zig-build", ["zig", "build"], { cwd: dir });
    case "macos":
      console.log(
        `[vela] building desktop-shell (swift build -c release --product vela-desktop-shell)…`,
      );
      return runForeground(
        "swift-build",
        ["swift", "build", "-c", "release", "--product", "vela-desktop-shell"],
        { cwd: dir },
      );
    case "windows":
      // Scaffold only until CMake target is real on Windows machines.
      console.log(
        `[vela] windows-shell has no automated build in CLI yet (see hosts/windows-shell/README.md)`,
      );
      return 1;
  }
}

async function ensureShellBinary(
  opts: DevOptions,
  platform: ShellPlatform,
): Promise<{ bin: string; platform: ShellPlatform }> {
  const bin = opts.shell ?? defaultShellBinary(platform);
  const dir = shellDir(platform);
  const needBuild = !opts.noBuild && (opts.build || !shellBinaryExists(bin));

  if (needBuild) {
    if (!existsSync(dir)) {
      throw new Error(`Shell tree missing: ${dir}`);
    }
    const code = await buildShell(platform, dir);
    if (code !== 0) {
      throw new Error(shellMissingHint(platform, bin));
    }
  }

  if (!shellBinaryExists(bin)) {
    throw new Error(shellMissingHint(platform, bin));
  }
  return { bin, platform };
}

async function startContentServer(target: ContentTarget, port: number): Promise<void> {
  const portEnv = contentPortEnv(port, target);
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...portEnv,
  };

  const script = target.script;
  const cwd = target.dir;
  const label = target.id;
  const cmd = ["bun", "run", script];

  console.log(
    `[vela] serving ${label} (${target.kind}) bun run ${script} on :${port}…`,
  );

  const proc = track(
    `serve:${label}`,
    Bun.spawn(cmd, {
      cwd,
      env: env as Record<string, string>,
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );

  const early = await Promise.race([
    proc.exited.then((code) => ({ kind: "exit" as const, code })),
    waitForHttp(`http://127.0.0.1:${port}/`).then(() => ({ kind: "ready" as const })),
  ]);

  if (early.kind === "exit") {
    throw new Error(`Content server exited early (code ${early.code ?? "?"})`);
  }
  console.log(`[vela] content ready`);
}

/**
 * Content resolution priority (closest to real app-author flow first):
 * 1. `--url` — content already running
 * 2. `--dir` — explicit package root (external or path)
 * 3. `--app` — monorepo pick by id
 * 4. nearest `vela.json` walking up from cwd (independent package / dogfood)
 * 5. monorepo workspace discovery (menu if several)
 */
async function resolveDevTarget(opts: DevOptions): Promise<ContentTarget | null> {
  if (opts.url) return null;

  if (opts.dir) {
    return resolveExternalTarget(opts.dir, opts.scriptExplicit ? opts.script : undefined);
  }

  if (opts.app) {
    const demo = await selectWorkspaceDemo(opts.app);
    return workspaceTargetFromDemo(demo);
  }

  // Primary real-world path: package root is cwd (or an ancestor).
  // e.g. `cd example/clock && bun run dev` or a standalone sibling app.
  const localRoot = findNearestPackageRoot(process.cwd());
  if (localRoot) {
    // Avoid treating the monorepo root as a package if it ever gains vela.json
    // for other reasons — only accept real package markers.
    console.log(`[vela] package root (cwd): ${localRoot}`);
    return resolveExternalTarget(localRoot);
  }

  const demo = await selectWorkspaceDemo();
  return workspaceTargetFromDemo(demo);
}

/** Print discovered packages (for `--list`). */
export function listDemos(): number {
  const demos = discoverDemos();
  if (demos.length === 0) {
    console.log(
      "[vela] No packages found (need vela.json under workspace packageParents). See docs/app-package-layout.md",
    );
    return 1;
  }
  console.log(`[vela] ${demos.length} package(s):\n${formatDemoList(demos)}`);
  return 0;
}

export async function runDev(opts: DevOptions): Promise<number> {
  if (opts.list) {
    return listDemos();
  }

  installSignalHandlers();

  try {
    const target = await resolveDevTarget(opts);
    const { url, startServe, port } = contentUrl(opts, target);

    if (startServe && target) {
      await startContentServer(target, port);
    } else {
      console.log(`[vela] using external URL ${url}`);
      if (url.includes("127.0.0.1") || url.includes("localhost")) {
        try {
          await waitForHttp(url.endsWith("/") ? url : `${url}/`, { timeoutMs: 5_000 });
        } catch {
          console.warn(`[vela] warning: URL not reachable yet: ${url}`);
        }
      }
    }

    if (opts.browser) {
      console.log(`[vela] browser mode — open ${url}`);
      console.log(`[vela] mock window.vela only; Ctrl+C to stop the server`);
      await new Promise<void>(() => {
        /* parked until SIGINT */
      });
      return 0;
    }

    const platform = resolveShellPlatform(opts.platform);
    console.log(`[vela] shell platform: ${platform}`);

    const { bin } = await ensureShellBinary(opts, platform);
    console.log(`[vela] launching Shell (${platform}) → ${url}`);
    const code = await runForeground(`${platform}-shell`, [bin, "--url", url.replace(/\/$/, "")], {
      cwd: shellDir(platform),
    });

    await killAll();
    return code;
  } catch (err) {
    console.error(`[vela] ${err instanceof Error ? err.message : err}`);
    await killAll();
    return 1;
  }
}
