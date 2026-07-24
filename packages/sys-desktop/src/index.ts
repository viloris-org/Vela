/**
 * @vela/sys-desktop — desktop Host systems facades for HostAPI.sys injection.
 * Prefer injecting these from the privileged desktop Host, not from App TS.
 *
 * Surfaces: notify, tray, dialog, clipboard, fs (+ createDesktopSystems convenience).
 * CLI backends are show/close (or open/save) only — action click events require
 * a richer long-lived helper (tray already provides that for menu/icon clicks).
 */

export { SystemsError, type SystemsErrorCode } from "./errors.ts";
export {
  escapeAppleScript,
  escapePowerShellSingle,
  escapeXml,
  stableNumericId,
} from "./escape.ts";
export {
  detectDesktopPlatform,
  isDesktopPlatform,
  requireDesktopPlatform,
  type DesktopPlatform,
} from "./platform.ts";
export {
  defaultRunCommand,
  commandExists,
  type RunCommand,
  type RunCommandRequest,
  type RunCommandResult,
} from "./run.ts";

export {
  createDesktopNotifySys,
  type CreateDesktopNotifySysOptions,
  type NotifyBackend,
  createLinuxNotifyBackend,
  createMacosNotifyBackend,
  createWindowsNotifyBackend,
} from "./notify/index.ts";

export {
  createDesktopDialogSys,
  type CreateDesktopDialogSysOptions,
  type DialogBackend,
  createLinuxDialogBackend,
  createMacosDialogBackend,
  createWindowsDialogBackend,
  zenityFileFilters,
  kdialogFilterString,
  winFormsFilterString,
  macosTypeList,
  normalizeExtensions,
} from "./dialog/index.ts";

export {
  createDesktopTraySys,
  type CreateDesktopTraySysOptions,
  type DesktopTraySys,
  type TrayBackend,
  createMemoryTrayBackend,
  createHelperTrayBackend,
} from "./tray/index.ts";

export {
  createDesktopClipboardSys,
  type CreateDesktopClipboardSysOptions,
  type ClipboardBackend,
  createLinuxClipboardBackend,
  createMacosClipboardBackend,
  createWindowsClipboardBackend,
} from "./clipboard/index.ts";

export {
  createDesktopFsSys,
  resolveUnderRoot,
  joinAppPath,
  type CreateDesktopFsSysOptions,
} from "./fs/index.ts";

export {
  createDesktopSystems,
  type CreateDesktopSystemsOptions,
  type DesktopSystems,
} from "./create-systems.ts";
