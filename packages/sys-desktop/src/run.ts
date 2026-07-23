/**
 * Injectable process runner for Host systems backends (testable without real OS tools).
 */

export type RunCommandRequest = {
  readonly cmd: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly stdin?: string;
  readonly timeoutMs?: number;
};

export type RunCommandResult = {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type RunCommand = (
  request: RunCommandRequest,
) => Promise<RunCommandResult>;

/** Default: Bun.spawn (desktop Host reference runtime). */
export const defaultRunCommand: RunCommand = async (request) => {
  const proc = Bun.spawn([request.cmd, ...(request.args ?? [])], {
    cwd: request.cwd,
    env: request.env !== undefined ? { ...process.env, ...request.env } : undefined,
    stdin: request.stdin !== undefined ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (request.stdin !== undefined && proc.stdin) {
    proc.stdin.write(request.stdin);
    proc.stdin.end();
  }

  // `timeoutMs: 0` (or negative) disables the timer — needed for interactive dialogs.
  const timeoutMs = request.timeoutMs === undefined ? 15_000 : request.timeoutMs;
  const collect = Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (timeoutMs <= 0) {
    const [code, stdout, stderr] = await collect;
    return { code, stdout, stderr };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`runCommand timeout after ${timeoutMs}ms: ${request.cmd}`));
    }, timeoutMs);
  });

  try {
    const [code, stdout, stderr] = await Promise.race([collect, timeout]);
    return { code, stdout, stderr };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** Which command exists on PATH (for capability probing). */
export async function commandExists(
  name: string,
  run: RunCommand = defaultRunCommand,
): Promise<boolean> {
  const isWin = process.platform === "win32";
  const result = await run({
    cmd: isWin ? "where.exe" : "which",
    args: [name],
    timeoutMs: 5_000,
  });
  return result.code === 0;
}
