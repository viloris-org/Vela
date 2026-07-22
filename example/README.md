# Examples

Small App TS samples that talk to `window.vela`. Not hosts and not the Phase 1 composition dogfood surface (`apps/playground`).

| Example | Package | What it shows |
|---------|---------|---------------|
| [clock](clock/) | `@vela/example-clock` | Digital clock UI, material insert, web-shaped opaque regions, mock bridge |

## Run

From monorepo root after `bun install`:

```bash
bun run example:clock   # http://localhost:5174
```

When no host injects `window.vela`, each example installs an in-page mock so layout and bridge calls are reviewable in a normal browser.
