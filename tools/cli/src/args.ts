export type TopCommand = "dev";

export type AppId = "clock" | "playground";

export type DevOptions = {
  app: AppId;
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
  app: "clock",
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

  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      out.help = true;
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
      if (v !== "clock" && v !== "playground") {
        throw new Error(`--app expects clock|playground, got ${v ?? "(missing)"}`);
      }
      out.dev.app = v;
      i += 1;
      continue;
    }
    if (a.startsWith("--app=")) {
      const v = a.slice("--app=".length);
      if (v !== "clock" && v !== "playground") {
        throw new Error(`--app expects clock|playground, got ${v}`);
      }
      out.dev.app = v;
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

  return out;
}

export function printHelp(command?: TopCommand): void {
  if (command === "dev") {
    console.log(`Usage: vela dev [options]

One-terminal instant dogfood: App content server + native Linux Shell.

Options:
  --app clock|playground   Content to serve (default: clock)
  --browser                Serve only; do not launch Shell (browser mock)
  --port <n>               Content server port (clock 5174, playground 5173)
  --url <url>              Skip local serve; open Shell at this URL
  --no-build               Never run zig build (fail if binary missing)
  --build                  Always run zig build before launch
                           (default: build only when binary is missing)
  --shell <path>           Path to vela-linux-shell binary
  -h, --help               Show this help

Examples:
  bun run dev
  bun run vela -- dev --app playground
  bun run vela -- dev --browser --app clock
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
  bun run dev                         # clock + linux-shell
  bun run vela -- dev --app playground
  bun run vela -- dev --browser       # content only

Planned (not yet):
  vela build    Static / ship-shaped artifacts
  vela run      Run a built tree

See docs/run-modes.md.
`);
}
