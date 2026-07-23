# Minimal App template

Copy source for a new Vela App package. Matches
[App package layout](../../docs/app-package-layout.md).

**Not** listed under `vela.workspace.json` `packageParents` — `vela dev` does
not auto-discover templates. Promote a copy into `apps/` or `example/` (or use
`--dir`) when you want it as a demo.

## Tree

```text
templates/minimal/
  vela.json        # required package marker
  package.json
  index.html
  styles.css
  serve.ts
  tsconfig.json
  src/
    main.ts
    mock-vela.ts
```

## Copy into the monorepo

```bash
# from repo root
cp -R templates/minimal apps/my-app
# edit apps/my-app/vela.json → unique id, name, dev.port
# edit package.json name (e.g. @vela/my-app)
# keep "@vela/api": "workspace:*" when staying in this monorepo
bun install
bun run vela -- dev --app my-app
```

## Copy outside the monorepo

```bash
cp -R templates/minimal ../MyApp
# set "@vela/api" to a published version or file: path into this monorepo
# then: bun install && bun run serve
# dogfood: bun run vela -- dev --dir ../MyApp
```

## After copy — rename checklist

| Place | Change |
|-------|--------|
| `vela.json` `id` | unique short id (`/^[a-z][a-z0-9_-]*$/i`) |
| `vela.json` `name` / `identifier` / `dev.port` | display + reverse-DNS + free port |
| `package.json` `name` | workspace package label |
| `serve.ts` log strings / `MINIMAL_PORT` fallback | optional; CLI injects `PORT` / `VELA_PORT` / `<ID>_PORT` |
| `index.html` title | display |

## Try in place (optional)

Templates are not workspace members. To smoke-serve without promoting:

```bash
# from a monorepo install so @vela/api resolves via workspace protocol only if linked;
# prefer promoting to apps/ for a real install path.
cd templates/minimal && bun ./serve.ts
```

Prefer **copy → apps/ or example/** for anything beyond a glance.
