import {
  NotifyEventChannels,
  type HostEventBus,
  type HostSystemsFacade,
  type NotifyActionEvent,
  type NotifyShowOptions,
  type NotifyShowResult,
} from "@vela/api";

export type MockNotifyRecord = {
  readonly options: NotifyShowOptions;
  readonly id: string;
};

/**
 * In-memory notify facade for unit tests and browser dogfood.
 * Optionally emits `notify.action` when `simulateAction` is called.
 */
export function createMockNotifySys(options?: {
  readonly events?: HostEventBus;
  /** Prefix for auto-generated ids. */
  readonly idPrefix?: string;
}): {
  readonly facade: NonNullable<HostSystemsFacade["notify"]>;
  readonly shown: MockNotifyRecord[];
  readonly closed: string[];
  simulateAction(event: NotifyActionEvent): void;
} {
  const shown: MockNotifyRecord[] = [];
  const closed: string[] = [];
  let seq = 0;
  const prefix = options?.idPrefix ?? "notify";
  const events = options?.events;

  const facade: NonNullable<HostSystemsFacade["notify"]> = {
    async show(opts): Promise<NotifyShowResult> {
      const id = opts.id ?? `${prefix}-${++seq}`;
      shown.push({ options: opts, id });
      return { id };
    },
    async close(id) {
      closed.push(id);
    },
  };

  return {
    facade,
    shown,
    closed,
    simulateAction(event) {
      events?.emit(NotifyEventChannels.action, event);
    },
  };
}
