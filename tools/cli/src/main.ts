#!/usr/bin/env bun
/**
 * Vela developer CLI — orchestrates instant-mode dogfood.
 *
 * Planned surface (docs/run-modes.md):
 *   vela dev     # start App content + native Shell (one terminal)
 *   vela build   # (future) static artifacts
 *   vela run     # (future) ship-shaped tree
 *
 * Today only `dev` is implemented for the Linux composition spike.
 */
import { runDev } from "./dev";
import { parseArgs, printHelp } from "./args";

const argv = process.argv.slice(2);
const parsed = parseArgs(argv);

if (parsed.help || !parsed.command) {
  printHelp(parsed.command);
  process.exit(parsed.help ? 0 : 1);
}

if (parsed.command === "dev") {
  const code = await runDev(parsed.dev);
  process.exit(code);
}

// parseArgs only sets known commands; anything else falls through as missing.
printHelp();
process.exit(1);
