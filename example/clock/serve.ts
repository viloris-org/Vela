/**
 * Serve the clock example as browser-executable assets for a Vela host WebView.
 * Bundles App TS → JS (WebKitGTK cannot run raw TypeScript).
 *
 * Host path:
 *   bun run example:clock
 *   zig build run -- --url http://127.0.0.1:5174   # hosts/linux-shell
 */
const root = import.meta.dir;
const port = Number(process.env["CLOCK_PORT"] ?? 5174);

let bundleJs: string | null = null;
let bundleError: string | null = null;

async function ensureBundle(): Promise<string> {
  if (bundleJs) return bundleJs;
  const result = await Bun.build({
    entrypoints: [`${root}/src/main.ts`],
    target: "browser",
    format: "esm",
    minify: false,
    sourcemap: "none",
  });
  if (!result.success) {
    const msg = result.logs.map((l) => l.message ?? String(l)).join("\n");
    bundleError = msg || "bun build failed";
    throw new Error(bundleError);
  }
  const artifact = result.outputs[0];
  if (!artifact) {
    bundleError = "bun build produced no outputs";
    throw new Error(bundleError);
  }
  bundleJs = await artifact.text();
  return bundleJs;
}

// Warm the bundle at startup so the first host navigation is ready.
try {
  const js = await ensureBundle();
  console.log(`@vela/example-clock bundled (${js.length} bytes)`);
} catch (err) {
  console.error(
    "@vela/example-clock bundle failed:",
    err instanceof Error ? err.message : err,
  );
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    path = path.replace(/\.\./g, "");

    if (path === "/main.js" || path === "/src/main.ts" || path === "/src/main.js") {
      try {
        // Rebuild each request in dev so host reloads pick up App TS edits.
        if (process.env["CLOCK_BUNDLE_CACHE"] !== "1") {
          bundleJs = null;
        }
        const js = await ensureBundle();
        return new Response(js, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(`// bundle error\nconsole.error(${JSON.stringify(msg)});`, {
          status: 500,
          headers: { "content-type": "application/javascript; charset=utf-8" },
        });
      }
    }

    const file = Bun.file(`${root}${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`@vela/example-clock → http://localhost:${server.port}`);
console.log(`  host: zig build run -- --url http://127.0.0.1:${server.port}`);
