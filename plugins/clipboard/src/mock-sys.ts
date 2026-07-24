import type { HostSystemsFacade } from "@vela/api";

export type CreateMockClipboardSysOptions = {
  /** Initial clipboard text. */
  readonly text?: string;
};

/**
 * In-memory clipboard facade for unit tests and browser dogfood.
 */
export function createMockClipboardSys(
  options: CreateMockClipboardSysOptions = {},
): {
  readonly facade: NonNullable<HostSystemsFacade["clipboard"]>;
  /** Current text buffer (mutable for assertions). */
  text: string;
  readonly reads: number;
  readonly writes: string[];
} {
  let text = options.text ?? "";
  const writes: string[] = [];
  let reads = 0;

  const facade: NonNullable<HostSystemsFacade["clipboard"]> = {
    async readText() {
      reads += 1;
      return text;
    },
    async writeText(next) {
      writes.push(next);
      text = next;
    },
  };

  return {
    facade,
    get text() {
      return text;
    },
    set text(v: string) {
      text = v;
    },
    get reads() {
      return reads;
    },
    writes,
  };
}
