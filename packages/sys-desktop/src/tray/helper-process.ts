import type { HostEventBus, TrayActionEvent, TrayMenuItem } from "@vela/api";
import { TrayEventChannels } from "@vela/api";
import { SystemsError } from "../errors.ts";
import type { DesktopPlatform } from "../platform.ts";

export type HelperSpawnSpec = {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd?: string;
};

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Long-lived tray helper process (JSON-lines request/response + async events).
 */
export class TrayHelperProcess {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = "";
  private ready = false;
  private starting: Promise<void> | null = null;
  private disposed = false;

  constructor(
    private readonly platform: DesktopPlatform,
    private readonly spec: HelperSpawnSpec,
    private readonly events?: HostEventBus,
  ) {}

  async ensureStarted(): Promise<void> {
    if (this.disposed) {
      throw new SystemsError("invalid_state", "tray helper already disposed", {
        platform: this.platform,
        feature: "tray",
      });
    }
    if (this.ready && this.proc) return;
    if (this.starting) return await this.starting;

    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async start(): Promise<void> {
    try {
      this.proc = Bun.spawn([this.spec.cmd, ...this.spec.args], {
        cwd: this.spec.cwd,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (err) {
      throw new SystemsError(
        "spawn_failed",
        `failed to spawn tray helper: ${err instanceof Error ? err.message : String(err)}`,
        { platform: this.platform, feature: "tray", cause: err },
      );
    }

    const readyWait = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new SystemsError(
            "spawn_failed",
            "tray helper did not become ready in time",
            { platform: this.platform, feature: "tray" },
          ),
        );
      }, 8_000);

      const onReady = () => {
        clearTimeout(timer);
        this.ready = true;
        resolve();
      };

      void this.readLoop(onReady, (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // also surface stderr for debugging
    void (async () => {
      if (!this.proc?.stderr) return;
      const text = await new Response(this.proc.stderr).text();
      if (text.trim()) {
        // keep silent in production paths; tests can still pass
        console.error(`[vela-tray-${this.platform}] ${text.trim()}`);
      }
    })();

    await readyWait;
  }

  private async readLoop(
    onReady: () => void,
    onFatal: (err: Error) => void,
  ): Promise<void> {
    const stdout = this.proc?.stdout;
    if (!stdout) {
      onFatal(
        new SystemsError("spawn_failed", "tray helper has no stdout", {
          platform: this.platform,
          feature: "tray",
        }),
      );
      return;
    }

    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = this.buffer.indexOf("\n")) >= 0) {
          const line = this.buffer.slice(0, idx).trim();
          this.buffer = this.buffer.slice(idx + 1);
          if (!line) continue;
          this.handleLine(line, onReady, onFatal);
        }
      }
    } catch (err) {
      onFatal(
        err instanceof Error
          ? err
          : new Error(String(err)),
      );
    } finally {
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(
          new SystemsError("backend_failed", "tray helper exited", {
            platform: this.platform,
            feature: "tray",
          }),
        );
      }
      this.pending.clear();
      this.ready = false;
      this.proc = null;
    }
  }

  private handleLine(
    line: string,
    onReady: () => void,
    onFatal: (err: Error) => void,
  ): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = msg.type;
    if (type === "ready") {
      onReady();
      return;
    }
    if (type === "fatal") {
      onFatal(
        new SystemsError(
          "backend_missing",
          String(msg.error ?? "tray helper fatal"),
          { platform: this.platform, feature: "tray" },
        ),
      );
      return;
    }
    if (type === "event") {
      const payload = msg.payload as TrayActionEvent | undefined;
      if (payload && this.events) {
        this.events.emit(TrayEventChannels.action, payload);
      }
      return;
    }
    if (type === "res") {
      const id = msg.id;
      if (typeof id !== "number") return;
      const pending = this.pending.get(id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if (msg.ok === true) {
        pending.resolve(msg);
      } else {
        pending.reject(
          new SystemsError(
            "backend_failed",
            String(msg.error ?? "tray helper request failed"),
            { platform: this.platform, feature: "tray" },
          ),
        );
      }
    }
  }

  async request(
    body: Omit<Extract<import("./types.ts").TrayHelperRequest, { type: "req" }>, "type" | "id"> & {
      op: "create" | "update" | "remove" | "quit";
      trayId?: string;
      tooltip?: string;
      icon?: string;
      menu?: readonly TrayMenuItem[];
    },
  ): Promise<Record<string, unknown>> {
    await this.ensureStarted();
    const id = this.nextId++;
    const msg = { type: "req", id, ...body };

    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new SystemsError(
            "backend_failed",
            `tray helper timeout on op=${body.op}`,
            { platform: this.platform, feature: "tray" },
          ),
        );
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });

      const line = JSON.stringify(msg) + "\n";
      const stdin = this.proc?.stdin;
      if (!stdin) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          new SystemsError("spawn_failed", "tray helper stdin missing", {
            platform: this.platform,
            feature: "tray",
          }),
        );
        return;
      }
      stdin.write(line);
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    // Send quit while still not disposed — request() → ensureStarted() rejects
    // when disposed is true, which would skip graceful helper cleanup.
    try {
      if (this.ready && this.proc) {
        await this.request({ op: "quit" });
      }
    } catch {
      // ignore — fall through to kill
    }
    this.disposed = true;
    try {
      this.proc?.kill();
    } catch {
      // ignore
    }
    this.proc = null;
    this.ready = false;
  }
}
