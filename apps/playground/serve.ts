/**
 * Minimal static server for layout review (browser mock mode).
 * Host shell loads these files via file:// or a custom scheme instead.
 */
const root = import.meta.dir;

const server = Bun.serve({
  port: Number(process.env["PLAYGROUND_PORT"] ?? 5173),
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    // Prevent path escape
    path = path.replace(/\.\./g, "");
    const file = Bun.file(`${root}${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`@vela/playground → http://localhost:${server.port}`);
