export type TopCommand = "dev";

export type DevOptions = {
  /**
   * Workspace demo selector (`--app <id|package|number>`).
   * When omitted (and no `--dir` / `--url`), demos are auto-discovered;
   * a single match starts immediately, multiple matches prompt (TTY) or error.
   */
  app?: string;
  /**
   * External project root (absolute, or relative to process.cwd()).
   * When set, `vela dev` runs `bun run <script>` in that directory instead of
   * a discovered workspace demo.
   */
  dir?: string;
  /**
   * package.json script override for `--dir`.
   * When unset / default and not explicit, package `vela.json` dev.script wins.
   */
  script: string;
  /** True when user passed `--script` (so default "serve" does not override vela.json). */
  scriptExplicit: boolean;
  /** List discovered packages and exit (handled in main). */
  list: boolean;
  /** Serve only (browser mock). Do not launch native Shell. */
  browser: boolean;
  /** Skip `zig build` when the shell binary already exists. */
  noBuild: boolean;
  /** Force `zig build` even if binary exists. Default true when binary missing. */
  build: boolean;
  port?: number;
  /** Override content URL (implies do not start local serve). */
  url?: string;
  /** Shell binary path override. */
  shell?: string;
};

export type ParsedArgs = {
  command?: TopCommand;
  help: boolean;
  dev: DevOptions;
};

const DEFAULT_DEV: DevOptions = {
  script: "serve",
  scriptExplicit: false,
  list: false,
  browser: false,
  noBuild: false,
  /** false = auto: build only when binary is missing */
  build: false,
};

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    help: false,
    dev: { ...DEFAULT_DEV },
  };

  if (argv.length === 0) {
    out.help = true;
    return out;
  }

  let i = 0;
  const first = argv[i];
  if (first === "-h" || first === "--help" || first === "help") {
    out.help = true;
    return out;
  }

  if (first === "dev") {
    out.command = "dev";
    i += 1;
  } else if (first?.startsWith("-")) {
    // bare flags after missing command → treat as help + error
    out.help = true;
    return out;
  } else {
    // unknown top-level
    return out;
  }

  let appExplicit = false;
  let dirExplicit = false;

  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      out.help = true;
      i += 1;
      continue;
    }
    if (a === "--list") {
      out.dev.list = true;
      i += 1;
      continue;
    }
    if (a === "--browser") {
      out.dev.browser = true;
      i += 1;
      continue;
    }
    if (a === "--no-build") {
      out.dev.noBuild = true;
      out.dev.build = false;
      i += 1;
      continue;
    }
    if (a === "--build") {
      out.dev.build = true;
      out.dev.noBuild = false;
      i += 1;
      continue;
    }
    if (a === "--app") {
      const v = argv[++i];
      if (!v) throw new Error("--app expects an id (discovered demo id, package name, or list number)");
      out.dev.app = v;
      appExplicit = true;
      i += 1;
      continue;
    }
    if (a.startsWith("--app=")) {
      const v = a.slice("--app=".length);
      if (!v) throw new Error("--app expects an id (discovered demo id, package name, or list number)");
      out.dev.app = v;
      appExplicit = true;
      i += 1;
      continue;
    }
    if (a === "--dir") {
      const v = argv[++i];
      if (!v) throw new Error("--dir expects a path");
      out.dev.dir = v;
      dirExplicit = true;
      i += 1;
      continue;
    }
    if (a.startsWith("--dir=")) {
      const v = a.slice("--dir=".length);
      if (!v) throw new Error("--dir expects a path");
      out.dev.dir = v;
      dirExplicit = true;
      i += 1;
      continue;
    }
    if (a === "--script") {
      const v = argv[++i];
      if (!v) throw new Error("--script expects a package.json script name");
      out.dev.script = v;
      out.dev.scriptExplicit = true;
      i += 1;
      continue;
    }
    if (a.startsWith("--script=")) {
      const v = a.slice("--script=".length);
      if (!v) throw new Error("--script expects a package.json script name");
      out.dev.script = v;
      out.dev.scriptExplicit = true;
      i += 1;
      continue;
    }
    if (a === "--port") {
      const v = argv[++i];
      const n = Number(v);
      if (!v || !Number.isFinite(n) || n <= 0) {
        throw new Error(`--port expects a positive number, got ${v ?? "(missing)"}`);
      }
      out.dev.port = n;
      i += 1;
      continue;
    }
    if (a.startsWith("--port=")) {
      const n = Number(a.slice("--port=".length));
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--port expects a positive number, got ${a}`);
      }
      out.dev.port = n;
      i += 1;
      continue;
    }
    if (a === "--url") {
      const v = argv[++i];
      if (!v) throw new Error("--url expects a URL");
      out.dev.url = v;
      i += 1;
      continue;
    }
    if (a.startsWith("--url=")) {
      out.dev.url = a.slice("--url=".length);
      i += 1;
      continue;
    }
    if (a === "--shell") {
      const v = argv[++i];
      if (!v) throw new Error("--shell expects a path");
      out.dev.shell = v;
      i += 1;
      continue;
    }
    if (a.startsWith("--shell=")) {
      out.dev.shell = a.slice("--shell=".length);
      i += 1;
      continue;
    }
    throw new Error(`Unknown flag: ${a}`);
  }

  if (appExplicit && dirExplicit) {
    throw new Error("--app and --dir are mutually exclusive (use --dir for external projects)");
  }
  if (out.dev.scriptExplicit && !dirExplicit) {
    throw new Error("--script requires --dir");
  }
  if (out.dev.list && (dirExplicit || out.dev.url)) {
    throw new Error("--list cannot be combined with --dir or --url");
  }

  return out;
}

export function printHelp(command?: TopCommand): void {
  if (command === "dev") {
    console.log(`Usage: vela dev [options]

One-terminal instant dogfood: App content server + native Linux Shell.

Content (pick one style — first match wins):
  (default)                1) nearest vela.json walking up from cwd
                           2) else monorepo discover (menu if several)
  --dir <path>             Explicit package root (must contain vela.json)
  --app <id|name|n>        Monorepo pick by id (skip menu / cwd)
  --list                   Print monorepo packages and exit
  --script <name>          With --dir: override vela.json dev.script
  --url <url>              Skip local serve; open Shell at this URL

Other options:
  --browser                Serve only; do not launch Shell (browser mock)
  --port <n>               Content server port (default: vela.json dev.port)
  --no-build               Never run zig build (fail if binary missing)
  --build                  Always run zig build before launch
                           (default: build only when binary is missing)
  --shell <path>           Path to vela-linux-shell binary
  -h, --help               Show this help

Package standard (docs/app-package-layout.md):
  <app-root>/vela.json     REQUIRED root marker (id, optional dev.port/script)
  <app-root>/package.json  scripts for instant serve
  Monorepo: vela.workspace.json packageParents (default apps, example)

Serves receive PORT, VELA_PORT, and <ID>_PORT (e.g. CLOCK_PORT).

Examples:
  cd example/clock && bun run dev          # independent package (preferred)
  bun run dev                              # monorepo shortcut → example/clock
  bun run dev:pick                         # monorepo menu / discover
  bun run vela -- dev --dir example/clock
  bun run vela -- dev --dir ../Zepyyr
  bun run vela -- dev --list
  bun run vela -- dev --app playground --browser
  bun run vela -- dev --url http://127.0.0.1:5180
  bun run vela -- dev --no-build
`);
    return;
  }

  console.log(`Vela CLI (instant mode helpers)

Usage:
  vela <command> [options]

Commands:
  dev     Start App content + native Shell (Linux) in one terminal
  help    Show this help

Examples:
  cd example/clock && bun run dev          # real package-root flow
  bun run dev                              # → --dir example/clock
  bun run vela -- dev --dir ../Zepyyr
  bun run vela -- dev --list
  bun run vela -- dev --browser

Planned (not yet):
  vela build    Static / ship-shaped artifacts
  vela run      Run a built tree

See docs/run-modes.md.
`);
}
