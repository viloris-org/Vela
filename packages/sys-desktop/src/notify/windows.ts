import { SystemsError } from "../errors.ts";
import { escapePowerShellSingle, escapeXml } from "../escape.ts";
import type { CreateNotifyBackendOptions, NotifyBackend } from "./types.ts";

/**
 * Windows toast notifications via PowerShell + WinRT ToastNotificationManager.
 * Falls back to balloon tip on older hosts if toast path fails.
 */
export function createWindowsNotifyBackend(
  options: CreateNotifyBackendOptions,
): NotifyBackend {
  const run = options.run;
  const appName = options.appName ?? "Vela";

  return {
    platform: "windows",

    async show(opts) {
      const title = escapeXml(opts.title);
      const body = escapeXml(opts.body ?? "");
      const tag = escapeXml(opts.id);
      const app = escapeXml(appName);

      const toastScript = `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml(@'
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>${title}</text>
      <text>${body}</text>
    </binding>
  </visual>
</toast>
'@)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$toast.Tag = '${tag}'
$toast.Group = '${app}'
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${app}')
$notifier.Show($toast)
`;

      const result = await run({
        cmd: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", toastScript],
        timeoutMs: 15_000,
      });

      if (result.code === 0) {
        return { id: opts.id };
      }

      // Balloon fallback (System.Windows.Forms)
      const t = escapePowerShellSingle(opts.title);
      const b = escapePowerShellSingle(opts.body ?? "");
      const balloon = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.BalloonTipTitle = '${t}'
$n.BalloonTipText = '${b}'
$n.ShowBalloonTip(4000)
Start-Sleep -Milliseconds 500
$n.Dispose()
`;
      const retry = await run({
        cmd: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", balloon],
        timeoutMs: 15_000,
      });
      if (retry.code !== 0) {
        throw new SystemsError(
          "backend_failed",
          `Windows notification failed: ${result.stderr || retry.stderr || "toast and balloon both failed"}`,
          { platform: "windows", feature: "notify" },
        );
      }
      return { id: opts.id };
    },

    async close(id) {
      const tag = escapeXml(id);
      const app = escapeXml(appName);
      const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotificationManager]::History.Remove('${tag}', '${app}', '${app}')
`;
      await run({
        cmd: "powershell.exe",
        args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        timeoutMs: 10_000,
      });
      // best-effort
    },
  };
}
