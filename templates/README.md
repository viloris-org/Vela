# App templates

Scaffold **copy sources** for new Vela App packages. Each child directory is a
complete package tree matching [App package layout](../docs/app-package-layout.md).

| Template | Path | Intent |
|----------|------|--------|
| [minimal](minimal/) | `templates/minimal` | Smallest runnable App shell (`vela.json` + serve + mock) |

## Rules

1. **Copy, do not run as demos by default.** `templates` is **not** in
   `vela.workspace.json` `packageParents` and is **not** a Bun workspace
   member. `vela dev` will not list these ids until you promote a copy into
   `apps/*` or `example/*` (or pass `--dir`).
2. **Same package standard as apps.** A template root still has `vela.json`;
   after copy it is a normal App package (`kind: "app"`).
3. **No `vela create` yet.** First version is files + docs only. Rename
   `id` / `name` / `package.json` name / ports by hand (see each template
   README).
4. **Monorepo vs external.** Inside this repo, keep
   `"@vela/api": "workspace:*"`. Outside, point `@vela/api` at a published
   version or a `file:` path into the monorepo.

## Promote a template

```bash
# monorepo demo
cp -R templates/minimal apps/my-app
# edit apps/my-app/vela.json (unique id + port) and package.json name
bun install
bun run vela -- dev --list   # should show my-app

# external dogfood
cp -R templates/minimal ../MyApp
# fix @vela/api dependency, then:
bun run vela -- dev --dir ../MyApp
```

## Adding a template

1. Create `templates/<name>/` with a full App package tree (`vela.json` required).
2. Keep it self-contained (HTML/CSS/TS + `serve.ts`). Prefer minimal deps.
3. Document rename checklist in `templates/<name>/README.md`.
4. Add a row to the table above.
5. Do **not** add `templates` to `packageParents` unless you intentionally want
   scaffolds to appear in the `vela dev` picker.

## Related

- [App package layout](../docs/app-package-layout.md) — tree SoT
- [Run modes](../docs/run-modes.md) — instant vs static
- [Examples](../example/) — runnable samples (discovered demos)
