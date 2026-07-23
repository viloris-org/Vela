import type { HostEventBus } from "@vela/api";

/**
 * In-process Host event bus (OS / plugin → App).
 * Runtime host bridges `subscribe` to preload `window.vela.events`.
 */
export function createHostEventBus(): HostEventBus {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  return {
    subscribe(channel, handler) {
      let set = handlers.get(channel);
      if (set === undefined) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set !== undefined && set.size === 0) {
          handlers.delete(channel);
        }
      };
    },
    emit(channel, payload) {
      const set = handlers.get(channel);
      if (set === undefined) {
        return;
      }
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          // Isolate subscribers: one throwing handler must not abort delivery
          // or crash the host (tray clicks, notify actions, etc.).
          console.error(
            `[host-event-bus] handler error on channel "${channel}":`,
            err,
          );
        }
      }
    },
  };
}
