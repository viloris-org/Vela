import type { HostSystemsFacade } from "@vela/api";

/**
 * In-memory shell facade for unit tests and browser dogfood.
 * Records openExternal URLs; does not spawn OS handlers.
 */
export function createMockShellSys(): {
  readonly facade: NonNullable<HostSystemsFacade["shell"]>;
  readonly opened: string[];
} {
  const opened: string[] = [];

  const facade: NonNullable<HostSystemsFacade["shell"]> = {
    async openExternal(url) {
      opened.push(url);
    },
  };

  return { facade, opened };
}
