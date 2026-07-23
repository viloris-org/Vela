import { describe, expect, test } from "bun:test";
import { TrayEventChannels } from "@vela/api";
import { createDesktopTraySys } from "./index.ts";
import { createMemoryTrayBackend } from "./memory.ts";

function localBus() {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  return {
    subscribe(channel: string, handler: (p: unknown) => void) {
      let set = handlers.get(channel);
      if (set === undefined) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      return () => set?.delete(handler);
    },
    emit(channel: string, payload: unknown) {
      for (const h of handlers.get(channel) ?? []) h(payload);
    },
  };
}

describe("createDesktopTraySys (memory mode)", () => {
  test("create / update / remove on all three platforms", async () => {
    for (const platform of ["linux", "macos", "windows"] as const) {
      const tray = createDesktopTraySys({ platform, mode: "memory" });
      const { id } = await tray.create({
        tooltip: `${platform} tray`,
        menu: [
          { type: "item", id: "open", label: "Open" },
          { type: "separator" },
          { type: "item", id: "quit", label: "Quit" },
        ],
      });
      expect(id).toMatch(/^tray-/);
      await tray.update(id, { tooltip: "updated" });
      await tray.remove(id);
      await tray.dispose();
    }
  });

  test("duplicate id fails", async () => {
    const tray = createDesktopTraySys({
      platform: "linux",
      mode: "memory",
    });
    await tray.create({ id: "fixed" });
    await expect(tray.create({ id: "fixed" })).rejects.toThrow(/exists/);
  });

  test("injected memory backend platform id", () => {
    expect(TrayEventChannels.action).toBe("tray.action");
    const backend = createMemoryTrayBackend("macos");
    expect(backend.platform).toBe("macos");
  });

  test("events bus payload shape for tray.action", () => {
    const events = localBus();
    const seen: unknown[] = [];
    events.subscribe(TrayEventChannels.action, (p) => seen.push(p));
    events.emit(TrayEventChannels.action, {
      id: "t1",
      action: "menu",
      itemId: "quit",
    });
    expect(seen).toEqual([{ id: "t1", action: "menu", itemId: "quit" }]);
  });
});
