import type { DialogFilter } from "@vela/api";

/** Strip leading dots; treat `*` as all-files. */
export function normalizeExtensions(exts: readonly string[]): string[] {
  return exts.map((e) => (e.startsWith(".") ? e.slice(1) : e));
}

/** Zenity: `Name | *.png *.jpg` (multiple `--file-filter` flags). */
export function zenityFileFilters(filters: readonly DialogFilter[]): string[] {
  const args: string[] = [];
  for (const f of filters) {
    const exts = normalizeExtensions(f.extensions);
    const patterns = exts.map((e) => (e === "*" ? "*" : `*.${e}`)).join(" ");
    args.push("--file-filter", `${f.name} | ${patterns}`);
  }
  return args;
}

/**
 * kdialog name-filter string.
 *
 * KDE/Qt name filters accept `patterns|label` groups (see kdialog docs /
 * KFileFilter). Multiple groups are separated by newlines.
 * Example: `*.json|JSON\n*|All files`
 */
export function kdialogFilterString(filters: readonly DialogFilter[]): string {
  const parts = filters.map((f) => {
    const exts = normalizeExtensions(f.extensions);
    const patterns = exts.map((e) => (e === "*" ? "*" : `*.${e}`)).join(" ");
    return `${patterns}|${f.name}`;
  });
  if (!parts.some((p) => p.startsWith("*|") || p.startsWith("*.*|"))) {
    parts.push("*|All files");
  }
  return parts.join("\n");
}

/**
 * Windows Forms Filter: `Name|*.png;*.jpg|All files|*.*`
 */
export function winFormsFilterString(filters: readonly DialogFilter[]): string {
  const parts: string[] = [];
  for (const f of filters) {
    const exts = normalizeExtensions(f.extensions);
    const patterns = exts.map((e) => (e === "*" ? "*.*" : `*.${e}`)).join(";");
    parts.push(`${f.name}|${patterns}`);
  }
  if (!parts.some((p) => p.endsWith("|*.*"))) {
    parts.push("All files|*.*");
  }
  return parts.join("|");
}

/**
 * macOS `choose file of type {…}` — extension strings without dots.
 * Returns empty when filters are absent or only `*`.
 */
export function macosTypeList(filters: readonly DialogFilter[] | undefined): string[] {
  if (filters === undefined || filters.length === 0) {
    return [];
  }
  const types = new Set<string>();
  for (const f of filters) {
    for (const e of normalizeExtensions(f.extensions)) {
      if (e !== "*") {
        types.add(e.toLowerCase());
      }
    }
  }
  return [...types];
}
