import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import { escapeAppleScript } from "../escape.ts";
import { macosTypeList } from "./filters.ts";
import type { CreateDialogBackendOptions, DialogBackend } from "./types.ts";

function isUserCanceled(stderr: string, stdout: string): boolean {
  const text = `${stderr}\n${stdout}`.toLowerCase();
  return (
    text.includes("user canceled") ||
    text.includes("user cancelled") ||
    text.includes("-128")
  );
}

function posixPathsFromStdout(stdout: string): string[] {
  // AppleScript returns comma-separated POSIX paths when we join with linefeeds.
  const trimmed = stdout.replace(/\r?\n$/, "").trim();
  if (trimmed.length === 0) return [];
  return trimmed
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function buildOpenScript(options: DialogOpenOptions): string {
  const prompt = escapeAppleScript(options.title ?? "Open");
  const types = macosTypeList(options.filters);
  const typeClause =
    types.length > 0
      ? ` of type {${types.map((t) => `"${escapeAppleScript(t)}"`).join(", ")}}`
      : "";

  if (options.directory) {
    let script = `set theFolder to choose folder with prompt "${prompt}"`;
    if (options.defaultPath) {
      const p = escapeAppleScript(options.defaultPath);
      script += ` default location (POSIX file "${p}")`;
    }
    script += `\nreturn POSIX path of theFolder`;
    return script;
  }

  const multi = options.multiple === true ? " with multiple selections allowed" : "";
  let script = `set theFiles to choose file with prompt "${prompt}"${typeClause}${multi}`;
  if (options.defaultPath) {
    const p = escapeAppleScript(options.defaultPath);
    script += ` default location (POSIX file "${p}")`;
  }
  if (options.multiple) {
    script += `
set pathList to {}
repeat with f in theFiles
  set end of pathList to POSIX path of f
end repeat
set AppleScript's text item delimiters to linefeed
return pathList as text
`;
  } else {
    script += `\nreturn POSIX path of theFiles`;
  }
  return script;
}

function buildSaveScript(options: DialogSaveOptions): string {
  const prompt = escapeAppleScript(options.title ?? "Save");
  const defaultName = escapeAppleScript(options.defaultName ?? "Untitled");
  let script = `set theFile to choose file name with prompt "${prompt}" default name "${defaultName}"`;
  if (options.defaultPath) {
    const p = escapeAppleScript(options.defaultPath);
    // If defaultPath looks like a file, use its parent as location when possible.
    script += ` default location (POSIX file "${p}")`;
  }
  script += `\nreturn POSIX path of theFile`;
  return script;
}

/**
 * macOS file dialogs via `osascript` / Standard Additions.
 */
export function createMacosDialogBackend(
  options: CreateDialogBackendOptions,
): DialogBackend {
  const run = options.run;

  return {
    platform: "macos",

    async open(opts): Promise<DialogOpenResult> {
      const script = buildOpenScript(opts);
      const result = await run({
        cmd: "osascript",
        args: ["-e", script],
        timeoutMs: 0,
      });
      if (result.code !== 0) {
        if (isUserCanceled(result.stderr, result.stdout)) {
          return { canceled: true, paths: [] };
        }
        throw new SystemsError(
          "backend_failed",
          `osascript open dialog failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "macos", feature: "dialog" },
        );
      }
      const paths = posixPathsFromStdout(result.stdout);
      return paths.length === 0
        ? { canceled: true, paths: [] }
        : { canceled: false, paths };
    },

    async save(opts): Promise<DialogSaveResult> {
      const script = buildSaveScript(opts);
      const result = await run({
        cmd: "osascript",
        args: ["-e", script],
        timeoutMs: 0,
      });
      if (result.code !== 0) {
        if (isUserCanceled(result.stderr, result.stdout)) {
          return { canceled: true, path: null };
        }
        throw new SystemsError(
          "backend_failed",
          `osascript save dialog failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "macos", feature: "dialog" },
        );
      }
      const path = result.stdout.trim();
      return path.length === 0
        ? { canceled: true, path: null }
        : { canceled: false, path };
    },
  };
}
