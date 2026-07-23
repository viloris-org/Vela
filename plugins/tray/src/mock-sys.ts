import {
  TrayEventChannels,
  type HostEventBus,
  type HostSystemsFacade,
  type TrayActionEvent,
  type TrayCreateOptions,
  type TrayCreateResult,
  type TrayMenuItem,
} from "@vela/api";

export type MockTrayState = {
  id: string;
  tooltip?: string;
  icon?: string;
  menu?: readonly TrayMenuItem[];
};

/**
 * In-memory tray facade for unit tests and browser dogfood.
 */
export function createMockTraySys(options?: {
  readonly events?: HostEventBus;
  readonly idPrefix?: string;
}): {
  readonly facade: NonNullable<HostSystemsFacade["tray"]>;
  readonly trays: Map<string, MockTrayState>;
  simulateAction(event: TrayActionEvent): void;
} {
  const trays = new Map<string, MockTrayState>();
  let seq = 0;
  const prefix = options?.idPrefix ?? "tray";
  const events = options?.events;

  const facade: NonNullable<HostSystemsFacade["tray"]> = {
    async create(opts: TrayCreateOptions): Promise<TrayCreateResult> {
      const id = opts.id ?? `${prefix}-${++seq}`;
      if (trays.has(id)) {
        throw new Error(`tray.create: id already exists: ${id}`);
      }
      const state: MockTrayState = { id };
      if (opts.tooltip !== undefined) state.tooltip = opts.tooltip;
      if (opts.icon !== undefined) state.icon = opts.icon;
      if (opts.menu !== undefined) state.menu = opts.menu;
      trays.set(id, state);
      return { id };
    },
    async update(id, patch) {
      const existing = trays.get(id);
      if (existing === undefined) {
        throw new Error(`tray.update: unknown id: ${id}`);
      }
      if (patch.tooltip !== undefined) existing.tooltip = patch.tooltip;
      if (patch.icon !== undefined) existing.icon = patch.icon;
      if (patch.menu !== undefined) existing.menu = patch.menu;
    },
    async remove(id) {
      if (!trays.delete(id)) {
        throw new Error(`tray.remove: unknown id: ${id}`);
      }
    },
  };

  return {
    facade,
    trays,
    simulateAction(event) {
      events?.emit(TrayEventChannels.action, event);
    },
  };
}
