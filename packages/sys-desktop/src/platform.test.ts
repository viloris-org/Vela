import { describe, expect, test } from "bun:test";
import {
  detectDesktopPlatform,
  isDesktopPlatform,
  requireDesktopPlatform,
} from "./platform.ts";

describe("desktop platform", () => {
  test("detectDesktopPlatform maps node platforms", () => {
    expect(detectDesktopPlatform("linux")).toBe("linux");
    expect(detectDesktopPlatform("darwin")).toBe("macos");
    expect(detectDesktopPlatform("win32")).toBe("windows");
    expect(detectDesktopPlatform("freebsd")).toBe("unknown");
  });

  test("isDesktopPlatform", () => {
    expect(isDesktopPlatform("linux")).toBe(true);
    expect(isDesktopPlatform("ios")).toBe(false);
  });

  test("requireDesktopPlatform throws for mobile", () => {
    expect(() => requireDesktopPlatform("ios", "notify")).toThrow(/desktop/);
  });
});
