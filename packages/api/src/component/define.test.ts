import { describe, expect, test, beforeEach } from "bun:test";
import {
  defineNativeComponent,
  getNativeComponent,
  listNativeComponents,
  __resetNativeComponentRegistryForTests,
} from "./define.ts";
import {
  defineCapability,
  registerBuiltinCapabilities,
  listCapabilities,
  __resetCapabilityRegistryForTests,
} from "../capability/define.ts";

describe("defineNativeComponent", () => {
  beforeEach(() => {
    __resetNativeComponentRegistryForTests();
  });

  test("registers and lists components", () => {
    defineNativeComponent({
      name: "camera.preview",
      permissions: ["camera:preview"],
      platforms: ["macos", "ios"],
      create: () => ({ id: "s1" }),
      setBounds: () => {},
      destroy: () => {},
    });
    expect(getNativeComponent("camera.preview")?.name).toBe("camera.preview");
    expect(listNativeComponents()).toEqual(["camera.preview"]);
  });

  test("rejects duplicates", () => {
    const factory = {
      name: "test.panel",
      permissions: [] as const,
      platforms: ["macos"] as const,
      create: () => ({ id: "x" }),
      setBounds: () => {},
      destroy: () => {},
    };
    defineNativeComponent(factory);
    expect(() => defineNativeComponent(factory)).toThrow(/duplicate/);
  });
});

describe("capabilities", () => {
  beforeEach(() => {
    __resetCapabilityRegistryForTests();
  });

  test("registerBuiltinCapabilities is idempotent", () => {
    registerBuiltinCapabilities();
    registerBuiltinCapabilities();
    const ids = listCapabilities().map((c) => c.id);
    expect(ids).toContain("window:material");
    expect(ids).toContain("camera:preview");
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("defineCapability rejects duplicates", () => {
    defineCapability({
      id: "custom:foo",
      description: "test",
      risk: "low",
    });
    expect(() =>
      defineCapability({
        id: "custom:foo",
        description: "test",
        risk: "low",
      }),
    ).toThrow(/duplicate/);
  });
});
