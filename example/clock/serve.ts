/**
 * Minimal static server for the clock example (browser mock mode).
 * A real host loads these files via file:// or a custom scheme instead.
 */
const root = import.meta.dir;

const server = Bun.serve({
  port: Number(process.env["CLOCK_PORT"] ?? 5174),
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    path = path.replace(/\.\./g, "");
    const file = Bun.file(`${root}${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`@vela/example-clock → http://localhost:${server.port}`);
