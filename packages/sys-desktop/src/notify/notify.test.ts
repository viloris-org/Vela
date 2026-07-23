import { describe, expect, test } from "bun:test";
import type { RunCommand, RunCommandRequest } from "../run.ts";
import { createDesktopNotifySys } from "./index.ts";
import { SystemsError } from "../errors.ts";

function scriptedRun(
  handler: (req: RunCommandRequest) => {
    code?: number;
    stdout?: string;
    stderr?: string;
  },
): RunCommand {
  return async (req) => {
    const r = handler(req);
    return {
      code: r.code ?? 0,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  };
}

describe("createDesktopNotifySys", () => {
  test("linux: notify-send argv shape with --print-id", async () => {
    const calls: RunCommandRequest[] = [];
    const notify = createDesktopNotifySys({
      platform: "linux",
      appName: "VelaTest",
      run: scriptedRun((req) => {
        calls.push(req);
        return { code: 0, stdout: "42\n" };
      }),
    });

    const result = await notify.show({
      title: "Hello",
      body: "World",
      id: "n1",
      icon: "dialog-info",
    });
    expect(result).toEqual({ id: "n1" });
    expect(calls[0]?.cmd).toBe("notify-send");
    expect(calls[0]?.args).toContain("Hello");
    expect(calls[0]?.args).toContain("World");
    expect(calls[0]?.args).toContain("--app-name");
    expect(calls[0]?.args).toContain("VelaTest");
    expect(calls[0]?.args).toContain("--print-id");
    expect(calls[0]?.args).toContain("--icon");
    expect(calls[0]?.args).toContain("dialog-info");
  });

  test("linux: close uses daemon id from --print-id", async () => {
    const calls: RunCommandRequest[] = [];
    const notify = createDesktopNotifySys({
      platform: "linux",
      run: scriptedRun((req) => {
        calls.push(req);
        if (req.cmd === "notify-send") return { code: 0, stdout: "99\n" };
        return { code: 0 };
      }),
    });
    await notify.show({ title: "T", id: "n-close" });
    expect(notify.close).toBeDefined();
    await notify.close!("n-close");
    const gdbus = calls.find((c) => c.cmd === "gdbus");
    expect(gdbus).toBeDefined();
    expect(gdbus!.args).toContain("99");
    expect(gdbus!.args).toContain(
      "org.freedesktop.Notifications.CloseNotification",
    );
  });

  test("linux: replace uses stored daemon id", async () => {
    const calls: RunCommandRequest[] = [];
    const notify = createDesktopNotifySys({
      platform: "linux",
      run: scriptedRun((req) => {
        calls.push(req);
        if (req.cmd === "notify-send") {
          // second show should pass --replace-id 7
          if (req.args?.includes("--replace-id")) {
            return { code: 0, stdout: "7\n" };
          }
          return { code: 0, stdout: "7\n" };
        }
        return { code: 0 };
      }),
    });
    await notify.show({ title: "A", id: "same" });
    await notify.show({ title: "B", id: "same" });
    const second = calls[1];
    expect(second?.args).toContain("--replace-id");
    expect(second?.args).toContain("7");
  });

  test("linux: retries without print-id / replace-id when unsupported", async () => {
    let n = 0;
    const notify = createDesktopNotifySys({
      platform: "linux",
      run: scriptedRun((req) => {
        n++;
        if (n === 1) {
          return { code: 1, stderr: "unrecognized option '--print-id'" };
        }
        // fallback without print-id may still try replace-id if mapped — none yet
        if (req.args?.includes("--print-id")) {
          return { code: 1, stderr: "unrecognized option '--print-id'" };
        }
        return { code: 0 };
      }),
    });
    await notify.show({ title: "T", id: "x" });
    expect(n).toBeGreaterThanOrEqual(2);
  });

  test("macos: osascript display notification", async () => {
    const calls: RunCommandRequest[] = [];
    const notify = createDesktopNotifySys({
      platform: "macos",
      run: scriptedRun((req) => {
        calls.push(req);
        return { code: 0 };
      }),
    });
    await notify.show({ title: 'Say "hi"', body: "body", id: "m1", silent: true });
    expect(calls[0]?.cmd).toBe("osascript");
    const script = calls[0]?.args?.[1] ?? "";
    expect(script).toContain("display notification");
    expect(script).toContain('Say \\"hi\\"');
    expect(script).not.toContain("sound name");
  });

  test("windows: powershell toast path", async () => {
    const calls: RunCommandRequest[] = [];
    const notify = createDesktopNotifySys({
      platform: "windows",
      run: scriptedRun((req) => {
        calls.push(req);
        return { code: 0 };
      }),
    });
    await notify.show({ title: "Win", body: "Toast", id: "w1" });
    expect(calls[0]?.cmd).toBe("powershell.exe");
    expect(calls[0]?.args?.join(" ")).toContain("ToastNotification");
  });

  test("windows: falls back to balloon when toast fails", async () => {
    let n = 0;
    const notify = createDesktopNotifySys({
      platform: "windows",
      run: scriptedRun(() => {
        n++;
        if (n === 1) return { code: 1, stderr: "no toast" };
        return { code: 0 };
      }),
    });
    await notify.show({ title: "Win", id: "w2" });
    expect(n).toBe(2);
  });

  test("backend failure surfaces SystemsError", async () => {
    const notify = createDesktopNotifySys({
      platform: "linux",
      run: scriptedRun(() => ({ code: 1, stderr: "boom" })),
    });
    await expect(notify.show({ title: "x" })).rejects.toBeInstanceOf(SystemsError);
  });

  test("auto-generates id when omitted", async () => {
    const notify = createDesktopNotifySys({
      platform: "linux",
      idPrefix: "auto",
      run: scriptedRun(() => ({ code: 0 })),
    });
    const a = await notify.show({ title: "a" });
    const b = await notify.show({ title: "b" });
    expect(a.id).toBe("auto-1");
    expect(b.id).toBe("auto-2");
  });
});
