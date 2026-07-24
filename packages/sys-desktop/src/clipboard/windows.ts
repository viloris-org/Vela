import { SystemsError } from "../errors.ts";
import { escapePowerShellSingle } from "../escape.ts";
import type {
  ClipboardBackend,
  CreateClipboardBackendOptions,
} from "./types.ts";

/**
 * Windows clipboard via PowerShell Get-Clipboard / Set-Clipboard.
 */
export function createWindowsClipboardBackend(
  options: CreateClipboardBackendOptions,
): ClipboardBackend {
  const run = options.run;

  return {
    platform: "windows",

    async readText() {
      const result = await run({
        cmd: "powershell.exe",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-Clipboard -Raw -ErrorAction Stop",
        ],
        timeoutMs: 15_000,
      });
      if (result.code !== 0) {
        // Empty clipboard can still succeed with empty stdout.
        throw new SystemsError(
          "backend_failed",
          `Get-Clipboard failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "windows", feature: "clipboard" },
        );
      }
      // PowerShell may append a trailing newline; keep raw content as returned.
      return result.stdout.replace(/\r\n$/u, "").replace(/\n$/u, "");
    },

    async writeText(text) {
      // Base64 of UTF-16LE avoids quoting hazards for arbitrary clipboard text.
      const b64 = Buffer.from(text, "utf16le").toString("base64");
      const encoded = `[System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${escapePowerShellSingle(b64)}')) | Set-Clipboard`;
      const result = await run({
        cmd: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-Command", encoded],
        timeoutMs: 15_000,
      });
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `Set-Clipboard failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "windows", feature: "clipboard" },
        );
      }
    },
  };
}
