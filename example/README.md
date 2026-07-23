# Examples

Small App TS samples that talk to `window.vela`. Not hosts and not the Phase 1 composition dogfood surface (`apps/playground`).

| Example | Package | What it shows |
|---------|---------|---------------|
| [clock](clock/) | `@vela/example-clock` | Digital clock UI, material insert, web-shaped opaque regions, mock bridge |

## Run (host path)

From monorepo root after `bun install`:

```bash
# terminal 1 — App content (bundled for WebView)
bun run example:clock   # http://127.0.0.1:5174

# terminal 2 — native Shell
cd hosts/linux-shell && zig build run -- --url http://127.0.0.1:5174
```

`serve.ts` bundles TypeScript to browser JS. The host injects `window.vela` via preload. Without a host, an in-page mock still works for layout review in a normal browser.
