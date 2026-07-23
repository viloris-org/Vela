/**
 * Serve this App package as browser-executable assets for a Vela host WebView.
 * Bundles App TS → JS (WebKitGTK cannot run raw TypeScript).
 *
 * Port resolution (first hit wins):
 *   PORT | VELA_PORT | MINIMAL_PORT | vela.json default (5180)
 *
 * After copying this template, rename id / package name / env key to match
 * the new app (see templates/README.md).
 */
const root = import.meta.dir;
const port = Number(
  process.env["PORT"] ??
    process.env["VELA_PORT"] ??
    process.env["MINIMAL_PORT"] ??
    5180,
);

let bundleJs: string | null = null;

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
    throw new Error(msg || "bun build failed");
  }
  const artifact = result.outputs[0];
  if (!artifact) throw new Error("bun build produced no outputs");
  bundleJs = await artifact.text();
  return bundleJs;
}

try {
  const js = await ensureBundle();
  console.log(`@vela/template-minimal bundled (${js.length} bytes)`);
} catch (err) {
  console.error(
    "@vela/template-minimal bundle failed:",
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
        if (process.env["VELA_BUNDLE_CACHE"] !== "1") {
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
        return new Response(
          `// bundle error\nconsole.error(${JSON.stringify(msg)});`,
          {
            status: 500,
            headers: { "content-type": "application/javascript; charset=utf-8" },
          },
        );
      }
    }

    const file = Bun.file(`${root}${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`@vela/template-minimal → http://localhost:${server.port}`);
console.log(`  host: zig build run -- --url http://127.0.0.1:${server.port}`);
