import type { Subprocess } from "bun";

export type ChildHandle = {
  label: string;
  proc: Subprocess;
};

const children: ChildHandle[] = [];
let cleaning = false;

export function track(label: string, proc: Subprocess): Subprocess {
  children.push({ label, proc });
  return proc;
}

export async function killAll(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
  if (cleaning) return;
  cleaning = true;
  // Reverse: shell first, then content server
  for (const { label, proc } of [...children].reverse()) {
    if (proc.exitCode !== null || proc.killed) continue;
    try {
      proc.kill(signal);
      console.log(`[vela] stopped ${label}`);
    } catch {
      // already gone
    }
  }
  // Brief grace, then SIGKILL stragglers
  await Bun.sleep(400);
  for (const { proc } of children) {
    if (proc.exitCode === null && !proc.killed) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }
  children.length = 0;
  cleaning = false;
}

export function installSignalHandlers(): void {
  const onSignal = (sig: NodeJS.Signals) => {
    console.log(`\n[vela] ${sig} — shutting down…`);
    void killAll("SIGTERM").then(() => process.exit(130));
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}

export async function waitForHttp(
  url: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 150;
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      // Any HTTP response means the server is up (404 is still "up").
      if (res.status >= 0) return;
    } catch (err) {
      lastErr = err;
    }
    await Bun.sleep(intervalMs);
  }
  throw new Error(
    `Timed out waiting for ${url} (${timeoutMs}ms). Last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

export async function runForeground(
  label: string,
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<number> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }

  console.log(`[vela] ${label}: ${cmd.join(" ")}`);
  const proc = track(
    label,
    Bun.spawn(cmd, {
      cwd: opts.cwd,
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  const code = await proc.exited;
  return code ?? 1;
}
