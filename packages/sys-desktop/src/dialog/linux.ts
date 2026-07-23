import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import { commandExists, type RunCommand } from "../run.ts";
import { kdialogFilterString, zenityFileFilters } from "./filters.ts";
import type { CreateDialogBackendOptions, DialogBackend } from "./types.ts";

type LinuxTool = "zenity" | "kdialog";

async function detectTool(run: RunCommand): Promise<LinuxTool | null> {
  if (await commandExists("zenity", run)) return "zenity";
  if (await commandExists("kdialog", run)) return "kdialog";
  return null;
}

function splitPaths(stdout: string, separator: string): string[] {
  const trimmed = stdout.replace(/\r?\n$/, "");
  if (trimmed.length === 0) return [];
  return trimmed
    .split(separator)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * zenity / kdialog use exit 1 for cancel, but some real failures also exit 1
 * with stderr. Treat empty stderr (and cancel-ish messages) as cancel; otherwise
 * surface as backend_failed.
 */
function isUserCancel(code: number, stderr: string, stdout: string): boolean {
  if (code !== 1) return false;
  const text = `${stderr}\n${stdout}`.trim();
  if (text.length === 0) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("dismiss") ||
    lower.includes("user aborted")
  );
}

async function zenityOpen(
  run: RunCommand,
  options: DialogOpenOptions,
): Promise<DialogOpenResult> {
  const args = ["--file-selection"];
  if (options.title) args.push("--title", options.title);
  if (options.defaultPath) args.push("--filename", options.defaultPath);
  if (options.directory) args.push("--directory");
  if (options.multiple && !options.directory) {
    args.push("--multiple", "--separator", "|");
  }
  if (options.filters && !options.directory) {
    args.push(...zenityFileFilters(options.filters));
  }

  const result = await run({ cmd: "zenity", args, timeoutMs: 0 });
  if (isUserCancel(result.code, result.stderr, result.stdout)) {
    return { canceled: true, paths: [] };
  }
  if (result.code !== 0) {
    throw new SystemsError(
      "backend_failed",
      `zenity open failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
      { platform: "linux", feature: "dialog" },
    );
  }
  const sep = options.multiple && !options.directory ? "|" : "\n";
  const paths = splitPaths(result.stdout, sep);
  return { canceled: false, paths };
}

async function zenitySave(
  run: RunCommand,
  options: DialogSaveOptions,
): Promise<DialogSaveResult> {
  const args = ["--file-selection", "--save", "--confirm-overwrite"];
  if (options.title) args.push("--title", options.title);

  let filename = options.defaultPath;
  if (options.defaultName) {
    if (filename && (filename.endsWith("/") || filename.endsWith("\\"))) {
      filename = `${filename}${options.defaultName}`;
    } else if (!filename) {
      filename = options.defaultName;
    }
  }
  if (filename) args.push("--filename", filename);
  if (options.filters) {
    args.push(...zenityFileFilters(options.filters));
  }

  const result = await run({ cmd: "zenity", args, timeoutMs: 0 });
  if (isUserCancel(result.code, result.stderr, result.stdout)) {
    return { canceled: true, path: null };
  }
  if (result.code !== 0) {
    throw new SystemsError(
      "backend_failed",
      `zenity save failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
      { platform: "linux", feature: "dialog" },
    );
  }
  const path = result.stdout.trim();
  if (path.length === 0) {
    return { canceled: true, path: null };
  }
  return { canceled: false, path };
}

async function kdialogOpen(
  run: RunCommand,
  options: DialogOpenOptions,
): Promise<DialogOpenResult> {
  if (options.directory) {
    const args = ["--getexistingdirectory", options.defaultPath ?? ""];
    if (options.title) args.push("--title", options.title);
    const result = await run({ cmd: "kdialog", args, timeoutMs: 0 });
    if (isUserCancel(result.code, result.stderr, result.stdout)) {
      return { canceled: true, paths: [] };
    }
    if (result.code !== 0) {
      throw new SystemsError(
        "backend_failed",
        `kdialog directory failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
        { platform: "linux", feature: "dialog" },
      );
    }
    const path = result.stdout.trim();
    return path.length === 0
      ? { canceled: true, paths: [] }
      : { canceled: false, paths: [path] };
  }

  const args = ["--getopenfilename", options.defaultPath ?? ""];
  if (options.filters) {
    args.push(kdialogFilterString(options.filters));
  }
  if (options.multiple) args.push("--multiple", "--separate-output");
  if (options.title) args.push("--title", options.title);

  const result = await run({ cmd: "kdialog", args, timeoutMs: 0 });
  if (isUserCancel(result.code, result.stderr, result.stdout)) {
    return { canceled: true, paths: [] };
  }
  if (result.code !== 0) {
    throw new SystemsError(
      "backend_failed",
      `kdialog open failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
      { platform: "linux", feature: "dialog" },
    );
  }
  // --separate-output: one path per line; without multiple, single path.
  const paths = splitPaths(result.stdout, "\n");
  return { canceled: false, paths };
}

async function kdialogSave(
  run: RunCommand,
  options: DialogSaveOptions,
): Promise<DialogSaveResult> {
  let start = options.defaultPath ?? "";
  if (options.defaultName && !start) {
    start = options.defaultName;
  } else if (
    options.defaultName &&
    start &&
    (start.endsWith("/") || start.endsWith("\\"))
  ) {
    start = `${start}${options.defaultName}`;
  }

  const args = ["--getsavefilename", start];
  if (options.filters) {
    args.push(kdialogFilterString(options.filters));
  }
  if (options.title) args.push("--title", options.title);

  const result = await run({ cmd: "kdialog", args, timeoutMs: 0 });
  if (isUserCancel(result.code, result.stderr, result.stdout)) {
    return { canceled: true, path: null };
  }
  if (result.code !== 0) {
    throw new SystemsError(
      "backend_failed",
      `kdialog save failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
      { platform: "linux", feature: "dialog" },
    );
  }
  const path = result.stdout.trim();
  return path.length === 0
    ? { canceled: true, path: null }
    : { canceled: false, path };
}

/**
 * Linux file dialogs via `zenity` (preferred) or `kdialog`.
 * Interactive dialogs must not use a short process timeout — `timeoutMs: 0` disables it.
 */
export function createLinuxDialogBackend(
  options: CreateDialogBackendOptions,
): DialogBackend {
  const run = options.run;
  let toolPromise: Promise<LinuxTool | null> | undefined;

  const resolveTool = async (): Promise<LinuxTool> => {
    toolPromise ??= detectTool(run);
    const tool = await toolPromise;
    if (tool === null) {
      throw new SystemsError(
        "backend_missing",
        "dialog requires zenity or kdialog on PATH",
        { platform: "linux", feature: "dialog" },
      );
    }
    return tool;
  };

  return {
    platform: "linux",

    async open(opts) {
      const tool = await resolveTool();
      return tool === "zenity" ? zenityOpen(run, opts) : kdialogOpen(run, opts);
    },

    async save(opts) {
      const tool = await resolveTool();
      return tool === "zenity" ? zenitySave(run, opts) : kdialogSave(run, opts);
    },
  };
}
