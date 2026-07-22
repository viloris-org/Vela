export type ShellEventHandler = (payload: unknown) => void;

export type ShellEventBus = {
  subscribe(channel: string, handler: ShellEventHandler): () => void;
  emit(channel: string, payload: unknown): void;
};

export function createEventBus(): ShellEventBus {
  const handlers = new Map<string, Set<ShellEventHandler>>();

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
        handler(payload);
      }
    },
  };
}
