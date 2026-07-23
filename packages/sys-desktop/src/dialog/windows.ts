import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
} from "@vela/api";
import { SystemsError } from "../errors.ts";
import { escapePowerShellSingle } from "../escape.ts";
import { winFormsFilterString } from "./filters.ts";
import type { CreateDialogBackendOptions, DialogBackend } from "./types.ts";

function isCancelExit(code: number, stdout: string): boolean {
  return code === 2 || stdout.trim() === "__VELA_DIALOG_CANCEL__";
}

function buildOpenScript(options: DialogOpenOptions): string {
  const title = escapePowerShellSingle(options.title ?? "Open");
  const initial = escapePowerShellSingle(options.defaultPath ?? "");
  const filter =
    options.filters && options.filters.length > 0
      ? escapePowerShellSingle(winFormsFilterString(options.filters))
      : "All files|*.*";

  if (options.directory) {
    return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = '${title}'
if ('${initial}' -ne '') { $d.SelectedPath = '${initial}' }
$r = $d.ShowDialog()
if ($r -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Output '__VELA_DIALOG_CANCEL__'
  exit 2
}
Write-Output $d.SelectedPath
`;
  }

  const multi = options.multiple === true ? "$true" : "$false";
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = '${title}'
$d.Filter = '${filter}'
$d.Multiselect = ${multi}
if ('${initial}' -ne '') {
  if (Test-Path -LiteralPath '${initial}' -PathType Container) {
    $d.InitialDirectory = '${initial}'
  } elseif (Test-Path -LiteralPath '${initial}') {
    $d.InitialDirectory = Split-Path -Parent '${initial}'
    $d.FileName = Split-Path -Leaf '${initial}'
  } else {
    $d.InitialDirectory = '${initial}'
  }
}
$r = $d.ShowDialog()
if ($r -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Output '__VELA_DIALOG_CANCEL__'
  exit 2
}
$d.FileNames -join [Environment]::NewLine
`;
}

function buildSaveScript(options: DialogSaveOptions): string {
  const title = escapePowerShellSingle(options.title ?? "Save");
  const initial = escapePowerShellSingle(options.defaultPath ?? "");
  const name = escapePowerShellSingle(options.defaultName ?? "");
  const filter =
    options.filters && options.filters.length > 0
      ? escapePowerShellSingle(winFormsFilterString(options.filters))
      : "All files|*.*";

  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = '${title}'
$d.Filter = '${filter}'
$d.OverwritePrompt = $true
if ('${name}' -ne '') { $d.FileName = '${name}' }
if ('${initial}' -ne '') {
  if (Test-Path -LiteralPath '${initial}' -PathType Container) {
    $d.InitialDirectory = '${initial}'
  } elseif (Test-Path -LiteralPath '${initial}') {
    $d.InitialDirectory = Split-Path -Parent '${initial}'
    $d.FileName = Split-Path -Leaf '${initial}'
  } else {
    $d.FileName = '${initial}'
  }
}
$r = $d.ShowDialog()
if ($r -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Output '__VELA_DIALOG_CANCEL__'
  exit 2
}
Write-Output $d.FileName
`;
}

/**
 * Windows file dialogs via PowerShell + System.Windows.Forms.
 */
export function createWindowsDialogBackend(
  options: CreateDialogBackendOptions,
): DialogBackend {
  const run = options.run;

  async function invoke(script: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return await run({
      cmd: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      timeoutMs: 0,
    });
  }

  return {
    platform: "windows",

    async open(opts): Promise<DialogOpenResult> {
      const result = await invoke(buildOpenScript(opts));
      if (isCancelExit(result.code, result.stdout)) {
        return { canceled: true, paths: [] };
      }
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `Windows open dialog failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "windows", feature: "dialog" },
        );
      }
      const paths = result.stdout
        .replace(/\r\n/g, "\n")
        .replace(/\n$/, "")
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p !== "__VELA_DIALOG_CANCEL__");
      return paths.length === 0
        ? { canceled: true, paths: [] }
        : { canceled: false, paths };
    },

    async save(opts): Promise<DialogSaveResult> {
      const result = await invoke(buildSaveScript(opts));
      if (isCancelExit(result.code, result.stdout)) {
        return { canceled: true, path: null };
      }
      if (result.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `Windows save dialog failed: ${result.stderr || result.stdout || `exit ${result.code}`}`,
          { platform: "windows", feature: "dialog" },
        );
      }
      const path = result.stdout.trim();
      if (path.length === 0 || path === "__VELA_DIALOG_CANCEL__") {
        return { canceled: true, path: null };
      }
      return { canceled: false, path };
    },
  };
}
