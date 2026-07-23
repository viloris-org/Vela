# App package layout

> **Type**: Reference  
> **Status**: Current  
> **Audience**: App authors | CLI / adapter authors | Maintainers  
> **SoT**: This page for the on-disk tree; `@vela/api` `project/*` for parse types  
> (`parseVelaPackage`, `parseVelaWorkspace`); [AppManifest](api-contracts.md) for  
> capability packaging (separate file)

A **Vela App package** is a directory tree with a fixed **root marker** and a
small set of conventional paths. Instant CLI, static packaging, and external
dogfood (for example a sibling repo) all locate apps by this layout — not by
guessing monorepo package names or hardcoding demo ids.

## Root marker (required)

| File | Role |
|------|------|
| **`vela.json`** | Package root marker + project descriptor (`schemaVersion: 1`) |

A directory **is** a Vela App package root **if and only if** it contains a
valid `vela.json`. Adapters must not treat “has `package.json` + `serve`” or
“lives under `apps/`” as sufficient without the marker.

Canonical constant: `VELA_PACKAGE_MARKER` in `@vela/api`.

### Minimal `vela.json`

```json
{
  "schemaVersion": 1,
  "id": "clock"
}
```

### Recommended fields

```json
{
  "schemaVersion": 1,
  "id": "clock",
  "name": "Clock",
  "kind": "app",
  "version": "0.0.1",
  "identifier": "dev.vela.clock",
  "dev": {
    "port": 5174,
    "script": "serve"
  },
  "entry": {
    "web": "index.html",
    "scheme": "app"
  }
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `schemaVersion` | yes | `1` |
| `id` | yes | Stable short id (`/^[a-z][a-z0-9_-]*$/i`); CLI `--app` |
| `name` | no | Display name |
| `kind` | no | `"app"` (default) |
| `dev.port` | no | Instant HTTP port (default tooling: `5173`) |
| `dev.script` | no | `package.json` script for content serve (default: `serve`) |
| `entry.web` | no | Web entry relative to package root (default convention: `index.html`) |
| `entry.scheme` | no | Production scheme hint (e.g. `app`) |
| `identifier` | no | Reverse-DNS id for packaging |
| `version` | no | App version string |

Parse: `parseVelaPackage` / `isVelaPackage`.

## Standard tree

```text
<app-root>/                 # package root = directory containing vela.json
  vela.json                 # REQUIRED — root marker + descriptor
  package.json              # REQUIRED for instant Bun serve (scripts)
  index.html                # default web entry (or entry.web)
  src/                      # recommended App TypeScript
    main.ts
  styles.css                # optional
  assets/                   # optional static assets
  serve.ts                  # optional; usually wired as scripts.serve
  tsconfig.json             # optional
  dist/                     # optional static-mode output (entry.web may point here)
  vela.manifest.json        # optional AppManifest (capabilities; Phase 2 packaging)
  README.md                 # optional
```

### Rules

1. **Root is defined by `vela.json`**, not by parent folder name.
2. **Instant mode** runs `bun run <dev.script|serve>` with `cwd = <app-root>`,
   and injects `PORT`, `VELA_PORT`, and `<ID>_PORT` (id uppercased).
3. **WebView loads HTTP (instant) or packaged entry (static)** — App JS never
   requires Bun on the end-user device ([run modes](run-modes.md)).
4. **`package.json` is toolchain**, not identity. Do not put package identity
   only in a `package.json` `"vela"` field; identity lives in `vela.json`.
5. **`vela.manifest.json`** (when present) is the capability / packaging
   manifest ([`AppManifest`](../packages/api/src/manifest/types.ts)). It does
   **not** replace `vela.json` as the tree root marker.

## Independent package root (preferred dogfood)

Treat each App as a **standalone project** whose cwd is the package root. This
matches external apps (for example a sibling `Zepyyr` repo).

```bash
# Preferred: run from the package root
cd example/clock
bun run dev          # package.json → vela CLI --dir .

# Explicit path (from monorepo root or anywhere)
bun run vela -- dev --dir example/clock
bun run vela -- dev --dir ../Zepyyr
```

**Default resolution when flags are omitted:**

1. Walk **up from `process.cwd()`** for the nearest `vela.json` → use that package.
2. Else monorepo discovery via `vela.workspace.json` (menu if several).

Any directory with a valid `vela.json` is a package, including repos outside
the monorepo. No workspace membership required for `--dir` / cwd package mode.

In this monorepo, root `bun run dev` is a shortcut for
`vela dev --dir example/clock` (clock as the reference independent package).
Use `bun run dev:pick` for multi-package discovery.

## Monorepo workspace (optional file)

At the **repository root** (not inside each app):

| File | Role |
|------|------|
| **`vela.workspace.json`** | Lists parent dirs to scan for packages |

```json
{
  "schemaVersion": 1,
  "packageParents": ["apps", "example"]
}
```

| Field | Meaning |
|-------|---------|
| `packageParents` | Relative dirs under the monorepo root; each is scanned **one level deep** for subdirectories that contain `vela.json` |

If the file is missing, tools use the default parents `apps` and `example`
(`DEFAULT_PACKAGE_PARENTS` / `defaultVelaWorkspace()`).

Canonical constant: `VELA_WORKSPACE_MARKER`.

### Discovery algorithm (instant CLI)

1. Load workspace: parse `vela.workspace.json` or use defaults.
2. For each `packageParent`, list immediate child directories.
3. If child has readable `vela.json` and `parseVelaPackage` succeeds → candidate.
4. Deduplicate by `id` (first wins after stable sort).
5. Resolve ports: `dev.port` or default; bump on collision.
6. Zero packages → error. One → start. Several → interactive pick (TTY) or require `--app`.

## Relationship to AppManifest

| Document | Path | Job |
|----------|------|-----|
| Package descriptor | `vela.json` | Tree root, id, instant `dev.*`, entry hints |
| App manifest | `vela.manifest.json` (optional today) | Capabilities, windows, production entry for packaging |

Later tooling may generate or merge these; until then keep them aligned by hand
when both exist (`entry.web` / `name` / `identifier`).

## Adding a new in-repo demo

1. Create `example/<id>/` or `apps/<id>/` (parent must be listed in workspace).
2. Add **`vela.json`** with unique `id` (and optional `dev.port`).
3. Add `package.json` with `"scripts": { "serve": "…" }` (or set `dev.script`).
4. Add `index.html` + App sources under `src/`.
5. Run `bun run vela -- dev --list` — the new id must appear without CLI code changes.

Prefer starting from a **template** (below) instead of copying a full demo.

## App templates (`templates/`)

| Path | Role |
|------|------|
| **`templates/<name>/`** | Scaffold **copy sources** — complete App package trees for new apps |

Rules:

1. Same on-disk package standard (`vela.json` + conventional paths).
2. **`templates` is not a default `packageParents` entry.** Instant CLI does
   **not** auto-discover templates; they are not demos until promoted (copy
   into `apps/` / `example/`) or loaded via `--dir`.
3. **`templates` is not a Bun workspace member** by default (no install as
   monorepo packages). After copy into `apps/*` or `example/*`, run
   `bun install` so `@vela/api` resolves.
4. First shipped template: [`templates/minimal`](../templates/minimal/) —
   smallest runnable shell (serve + in-page mock). Catalog:
   [`templates/README.md`](../templates/README.md).
5. **`vela create` / init is not required** for this layout; rename `id` /
   ports by hand until a create command exists.

```bash
cp -R templates/minimal apps/my-app
# edit vela.json id + dev.port; package.json name
bun install
bun run vela -- dev --app my-app
```

## Non-goals

- Scanning the entire monorepo for any `package.json` with a `serve` script.
- Hardcoding demo ids in the CLI.
- Treating workspace package names (`@vela/…`) as the primary package identity
  (they remain Bun install labels only).
- Treating `templates/*` as runtime demos without an explicit promote / `--dir`.

## Related

- [Run modes](run-modes.md) — instant vs static assembly
- [API contracts](api-contracts.md) — `@vela/api` map
- [App load and startup](app-load-and-startup.md) — WebView load model
- [Templates catalog](../templates/README.md) — scaffold copy sources
