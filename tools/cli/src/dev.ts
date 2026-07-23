import { existsSync } from "node:fs";
import type { DevOptions } from "./args";
import { APPS, defaultShellBinary, linuxShellDir, repoRoot, shellBinaryExists } from "./paths";
import { installSignalHandlers, killAll, runForeground, track, waitForHttp } from "./process";

function contentUrl(opts: DevOptions): { url: string; startServe: boolean; port: number } {
  if (opts.url) {
    return { url: opts.url, startServe: false, port: 0 };
  }
  const app = APPS[opts.app];
  const port = opts.port ?? app.defaultPort;
  return {
    url: `http://127.0.0.1:${port}/`,
    startServe: true,
    port,
  };
}

async function ensureShellBinary(opts: DevOptions): Promise<string> {
  const root = repoRoot();
  const bin = opts.shell ?? defaultShellBinary(root);
  // Default: build only when missing. --build forces; --no-build never.
  const needBuild = !opts.noBuild && (opts.build || !shellBinaryExists(bin));

  if (needBuild) {
    const shellDir = linuxShellDir(root);
    if (!existsSync(shellDir)) {
      throw new Error(`Linux shell tree missing: ${shellDir}`);
    }
    console.log(`[vela] building linux-shell (zig build)…`);
    const code = await runForeground("zig-build", ["zig", "build"], { cwd: shellDir });
    // runForeground tracks the short-lived build; untrack by killing finished is no-op
    if (code !== 0) {
      throw new Error(`zig build failed with exit ${code}`);
    }
  }

  if (!shellBinaryExists(bin)) {
    throw new Error(
      `Shell binary not found: ${bin}\n` +
        `  Install Zig 0.16.x + gtk4-devel + webkitgtk6.0-devel, then:\n` +
        `  cd hosts/linux-shell && zig build\n` +
        `  Or omit --no-build so \`vela dev\` builds automatically.`,
    );
  }
  return bin;
}

async function startContentServer(opts: DevOptions, port: number): Promise<void> {
  const root = repoRoot();
  const app = APPS[opts.app];
  const env: Record<string, string | undefined> = {
    ...process.env,
    [app.envPortKey]: String(port),
  };

  console.log(`[vela] serving ${app.id} on :${port}…`);
  const proc = track(
    `serve:${app.id}`,
    Bun.spawn(["bun", "run", "--filter", app.filter, "serve"], {
      cwd: root,
      env: env as Record<string, string>,
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );

  // If the serve process dies immediately, surface it.
  const early = await Promise.race([
    proc.exited.then((code) => ({ kind: "exit" as const, code })),
    waitForHttp(`http://127.0.0.1:${port}/`).then(() => ({ kind: "ready" as const })),
  ]);

  if (early.kind === "exit") {
    throw new Error(`Content server exited early (code ${early.code ?? "?"})`);
  }
  console.log(`[vela] content ready`);
}

export async function runDev(opts: DevOptions): Promise<number> {
  installSignalHandlers();

  try {
    const { url, startServe, port } = contentUrl(opts);

    if (startServe) {
      await startContentServer(opts, port);
    } else {
      console.log(`[vela] using external URL ${url}`);
      // Best-effort readiness if it looks local
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
      // Keep alive until signal
      await new Promise<void>(() => {
        /* parked until SIGINT */
      });
      return 0;
    }

    const bin = await ensureShellBinary(opts);
    console.log(`[vela] launching Shell → ${url}`);
    const code = await runForeground("linux-shell", [bin, "--url", url.replace(/\/$/, "")], {
      cwd: linuxShellDir(),
    });

    await killAll();
    return code;
  } catch (err) {
    console.error(`[vela] ${err instanceof Error ? err.message : err}`);
    await killAll();
    return 1;
  }
}
