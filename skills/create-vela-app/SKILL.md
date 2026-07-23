---
name: create-vela-app
description: >
  Scaffold a new Vela App package from templates/minimal (vela.json, serve,
  in-page mock). Use when creating a Vela app, starting a desktop WebView
  project on Vela, copying the minimal template, or the user asks to init or
  scaffold a Vela application. Not for contributing to the Vela framework repo
  internals.
---

# Create a Vela App

Scaffold a **standalone App package** for product work on Vela. Identity lives
in `vela.json`. App UI is ordinary web content; privileged OS access goes only
through `window.vela` after a host injects it.

There is **no** `vela create` yet. Copy `templates/minimal`, rename, install,
verify.

## Preconditions

- [Bun](https://bun.sh) on PATH (toolchain + instant `serve`)
- A Vela checkout that contains `templates/minimal` (or a copy of that tree)
- Free HTTP port for `dev.port` (template default `5180`)

## Choose destination

| Goal | Destination | `@vela/api` dependency |
|------|-------------|------------------------|
| Demo / dogfood inside the Vela monorepo | `apps/<id>/` or `example/<id>/` | `"workspace:*"` (keep after copy) |
| Standalone product repo | Any dir with its own root (e.g. `../MyApp`) | Published version, or `"file:<path-to-Vela>/packages/api"` |

Parent dirs `apps` and `example` are discovered by `vela.workspace.json`.
`templates/` is **not** auto-discovered; do not run the template in place as a
product app.

## Workflow

### 1. Copy the template

From the **Vela repo root** (adjust paths if the checkout lives elsewhere):

```bash
# monorepo demo
cp -R templates/minimal apps/my-app

# external product
cp -R templates/minimal ../MyApp
```

The package root is the directory that contains `vela.json`.

### 2. Rename checklist (required)

Edit after every copy:

| File / field | Rule |
|--------------|------|
| `vela.json` → `id` | Unique; `/^[a-z][a-z0-9_-]*$/i` (CLI `--app`) |
| `vela.json` → `name`, `identifier` | Display name; reverse-DNS e.g. `dev.you.app` |
| `vela.json` → `dev.port` | Free port; avoid colliding with other packages |
| `package.json` → `name` | e.g. `@vela/my-app` or `@you/my-app` |
| `package.json` → `@vela/api` | `workspace:*` in monorepo; file/registry outside |
| `index.html` → `<title>` | Match product name |
| `serve.ts` | Optional: log strings; port env fallback (`MINIMAL_PORT` → `<ID>_PORT`) |

Minimal valid `vela.json`:

```json
{
  "schemaVersion": 1,
  "id": "my-app"
}
```

Recommended shape matches App package layout (`docs/app-package-layout.md` in the Vela checkout, or https://github.com/viloris-org/Vela/blob/main/docs/app-package-layout.md).

### 3. Install

```bash
# monorepo: from Vela root after adding apps/* or example/*
bun install

# external: from the new package root
cd ../MyApp && bun install
```

### 4. Verify

**Content only** (browser + in-page mock when no host preload):

```bash
cd <app-root>
bun run serve
# open the printed http://localhost:<port>
```

Expect bridge status like `in-page mock` and a non-empty `vela.version`.

**Instant CLI** (content + Shell when available):

```bash
# monorepo, by id (after promote into apps/ or example/)
bun run vela -- dev --app my-app

# any package root (preferred for external apps)
bun run vela -- dev --dir <app-root>
# or from <app-root> if package.json has a dev script like example/clock
```

List discovered packages:

```bash
bun run vela -- dev --list
```

### 5. Next authoring steps

- Implement UI and `window.vela` usage with the **vela-app-ts** skill.
- Reference sample with layers + hit: `example/clock` in the Vela checkout.
- Optional later: `vela.manifest.json` for capability grants (packaging); does
  **not** replace `vela.json` as the root marker.

## Package rules (do not break)

1. A directory is a Vela App package **iff** it has a valid `vela.json`.
2. Instant mode runs `bun run <dev.script|serve>` with `cwd = <app-root>` and
   injects `PORT`, `VELA_PORT`, and `<ID>_PORT`.
3. `package.json` is toolchain only; do not put package identity only there.
4. End-user devices run App JS in the system WebView; they do not need Bun.
5. Prefer `templates/minimal` over cloning a full demo unless you need that
   demo's features (e.g. clock layers/hit).

## Non-goals

- Scaffolding Host plugins, Shell, or `@vela/shell-core` / `@vela/host-core`
- Inventing method names not present in `@vela/api`
- Treating `templates/*` as workspace demos without copy / `--dir`

## Related

Paths are under the Vela repository (https://github.com/viloris-org/Vela):

- `templates/minimal/README.md` — template rename notes
- `templates/README.md` — template catalog
- `docs/app-package-layout.md` — `vela.json` tree SoT
- `docs/run-modes.md` — instant vs static
- Skill sibling: `vela-app-ts` (install both: `npx skills add -g -y viloris-org/Vela`)
