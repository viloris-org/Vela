import { describe, expect, test } from "bun:test";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  test("dev defaults", () => {
    const p = parseArgs(["dev"]);
    expect(p.command).toBe("dev");
    expect(p.dev.app).toBe("clock");
    expect(p.dev.browser).toBe(false);
    expect(p.dev.build).toBe(false);
    expect(p.dev.noBuild).toBe(false);
  });

  test("dev flags", () => {
    const p = parseArgs([
      "dev",
      "--app",
      "playground",
      "--browser",
      "--port",
      "5199",
      "--no-build",
    ]);
    expect(p.dev.app).toBe("playground");
    expect(p.dev.browser).toBe(true);
    expect(p.dev.port).toBe(5199);
    expect(p.dev.noBuild).toBe(true);
    expect(p.dev.build).toBe(false);
  });

  test("equals form", () => {
    const p = parseArgs(["dev", "--app=clock", "--url=http://127.0.0.1:9/"]);
    expect(p.dev.app).toBe("clock");
    expect(p.dev.url).toBe("http://127.0.0.1:9/");
  });

  test("help", () => {
    expect(parseArgs([]).help).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["dev", "-h"]).help).toBe(true);
  });

  test("rejects bad app", () => {
    expect(() => parseArgs(["dev", "--app", "nope"])).toThrow(/clock\|playground/);
  });
});
