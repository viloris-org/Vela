# Examples

Small App TS samples that talk to `window.vela`. Not hosts and not the Phase 1 composition dogfood surface (`apps/playground`).

| Example | Package | What it shows |
|---------|---------|---------------|
| [clock](clock/) | `@vela/example-clock` | Digital clock UI, material insert, web-shaped opaque regions, mock bridge |

## Package standard

Every example is a **Vela App package**: directory with **`vela.json`** at the root.
See [App package layout](../docs/app-package-layout.md).

**Dogfood like a real app:** run tools **from the package root**, not as a
hardcoded monorepo special case.

```text
example/clock/
  vela.json          # required marker (id, dev.port, …)
  package.json       # "dev": vela CLI --dir .
  index.html
  src/
  serve.ts
```

## Run (independent package)

```bash
# Preferred — same shape as an external project (Zepyyr, …)
cd example/clock
bun run dev

# From monorepo root (shortcut pinned to clock)
bun run dev                 # → vela dev --dir example/clock
bun run vela -- dev --dir example/clock

# Multi-package menu (monorepo only)
bun run dev:pick
bun run vela -- dev --list
```

`serve.ts` bundles TypeScript to browser JS. The host injects `window.vela` via preload. Without a host, an in-page mock still works for layout review in a normal browser.

## Adding an example

1. Create `example/<id>/` with `vela.json` (`schemaVersion`, unique `id`).
2. Add `package.json` with `serve` (and optionally `dev` → monorepo CLI `--dir .`).
3. Add web entry + sources. Discovery uses `vela.json`, not CLI hardcoding.
