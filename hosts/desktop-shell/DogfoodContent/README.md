# DogfoodContent

Point the spike WKWebView at the playground package:

```text
../../../../apps/playground/
```

From monorepo root that is `apps/playground/` (`index.html`, `src/main.ts`, styles).

## Options

1. **Absolute / relative URL** in debug: load the playground directory from the checkout (developer machine).
2. **Xcode folder reference**: add `apps/playground` as a group; copy resources into the app bundle if needed.
3. **Symlink** (local only, optional):

   ```bash
   # from hosts/desktop-shell/DogfoodContent
   ln -s ../../../apps/playground content
   ```

   Do not rely on the symlink existing in CI on Linux.

Browser layout review without Swift:

```bash
bun run playground:serve
```
