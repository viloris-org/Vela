import { describe, expect, test } from "bun:test";
import {
  DEFAULT_OPEN_EXTERNAL_SCHEMES,
  ShellMethods,
  parseExternalUrl,
} from "./shell.ts";

describe("ShellMethods", () => {
  test("openExternal method id is stable", () => {
    expect(ShellMethods.openExternal).toBe("shell.openExternal");
  });
});

describe("parseExternalUrl", () => {
  test("accepts http / https / mailto", () => {
    expect(parseExternalUrl("https://example.com/path").ok).toBe(true);
    expect(parseExternalUrl("http://localhost:3000").ok).toBe(true);
    expect(parseExternalUrl("mailto:user@example.com").ok).toBe(true);
  });

  test("normalizes href", () => {
    const r = parseExternalUrl("  https://example.com/a  ");
    expect(r).toEqual({
      ok: true,
      href: "https://example.com/a",
      protocol: "https:",
    });
  });

  test("rejects empty and relative", () => {
    expect(parseExternalUrl("").ok).toBe(false);
    expect(parseExternalUrl("   ").ok).toBe(false);
    expect(parseExternalUrl("/relative").ok).toBe(false);
    expect(parseExternalUrl("example.com").ok).toBe(false);
  });

  test("rejects dangerous schemes", () => {
    expect(parseExternalUrl("file:///etc/passwd").ok).toBe(false);
    expect(parseExternalUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseExternalUrl("data:text/html,hi").ok).toBe(false);
    expect(parseExternalUrl("vbscript:msgbox").ok).toBe(false);
  });

  test("custom allowlist can add schemes", () => {
    const r = parseExternalUrl("custom:foo", [
      ...DEFAULT_OPEN_EXTERNAL_SCHEMES,
      "custom:",
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.protocol).toBe("custom:");
  });
});
