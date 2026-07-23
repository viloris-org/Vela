/** Escape a string for embedding in AppleScript double-quoted literals. */
export function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escape a string for PowerShell single-quoted literals (`'` → `''`). */
export function escapePowerShellSingle(s: string): string {
  return s.replace(/'/g, "''");
}

/** Escape for embedding in a double-quoted XML attribute / toast text node. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Map stable string ids to a positive int for backends that need numeric ids. */
export function stableNumericId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // keep in signed 31-bit positive range
  return (h >>> 0) % 2_000_000_000 || 1;
}
