import { describe, expect, test } from "bun:test";
import { createHostEventBus } from "./event-bus.ts";

describe("createHostEventBus", () => {
  test("delivers to all subscribers", () => {
    const bus = createHostEventBus();
    const seen: unknown[] = [];
    bus.subscribe("ch", (p) => seen.push(p));
    bus.subscribe("ch", (p) => seen.push(`b:${String(p)}`));
    bus.emit("ch", 1);
    expect(seen).toEqual([1, "b:1"]);
  });

  test("isolates throwing handlers so later subscribers still run", () => {
    const bus = createHostEventBus();
    const seen: string[] = [];
    bus.subscribe("tray.action", () => {
      throw new Error("boom");
    });
    bus.subscribe("tray.action", () => {
      seen.push("ok");
    });
    bus.emit("tray.action", { id: "t1" });
    expect(seen).toEqual(["ok"]);
  });

  test("unsubscribe stops delivery", () => {
    const bus = createHostEventBus();
    const seen: unknown[] = [];
    const off = bus.subscribe("x", (p) => seen.push(p));
    bus.emit("x", 1);
    off();
    bus.emit("x", 2);
    expect(seen).toEqual([1]);
  });
});
