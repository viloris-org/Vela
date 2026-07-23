import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
  HostSystemsFacade,
} from "@vela/api";

export type MockDialogOpenCall = {
  readonly options: DialogOpenOptions;
};

export type MockDialogSaveCall = {
  readonly options: DialogSaveOptions;
};

export type CreateMockDialogSysOptions = {
  /** Default paths returned by open when no queue is set. */
  readonly openPaths?: readonly string[];
  /** Default path returned by save when no queue is set. */
  readonly savePath?: string | null;
  /** When true, open/save report canceled (unless a queued result overrides). */
  readonly canceled?: boolean;
};

/**
 * In-memory dialog facade for unit tests and browser dogfood.
 * Queue results with `queueOpen` / `queueSave`, or set default paths.
 */
export function createMockDialogSys(options: CreateMockDialogSysOptions = {}): {
  readonly facade: NonNullable<HostSystemsFacade["dialog"]>;
  readonly openCalls: MockDialogOpenCall[];
  readonly saveCalls: MockDialogSaveCall[];
  queueOpen(result: DialogOpenResult): void;
  queueSave(result: DialogSaveResult): void;
} {
  const openCalls: MockDialogOpenCall[] = [];
  const saveCalls: MockDialogSaveCall[] = [];
  const openQueue: DialogOpenResult[] = [];
  const saveQueue: DialogSaveResult[] = [];

  const defaultCanceled = options.canceled === true;
  const defaultOpenPaths = options.openPaths ?? [];
  const defaultSavePath =
    options.savePath === undefined
      ? defaultCanceled
        ? null
        : "/tmp/vela-mock-save.txt"
      : options.savePath;

  const facade: NonNullable<HostSystemsFacade["dialog"]> = {
    async open(opts: DialogOpenOptions = {}): Promise<DialogOpenResult> {
      openCalls.push({ options: opts });
      const queued = openQueue.shift();
      if (queued !== undefined) {
        return queued;
      }
      if (defaultCanceled) {
        return { canceled: true, paths: [] };
      }
      const paths =
        opts.multiple === true
          ? [...defaultOpenPaths]
          : defaultOpenPaths.slice(0, 1);
      if (paths.length === 0 && defaultOpenPaths.length === 0) {
        return {
          canceled: false,
          paths: opts.directory === true ? ["/tmp/vela-mock-dir"] : ["/tmp/vela-mock-file.txt"],
        };
      }
      return { canceled: false, paths };
    },
    async save(opts: DialogSaveOptions = {}): Promise<DialogSaveResult> {
      saveCalls.push({ options: opts });
      const queued = saveQueue.shift();
      if (queued !== undefined) {
        return queued;
      }
      if (defaultCanceled || defaultSavePath === null) {
        return { canceled: true, path: null };
      }
      return { canceled: false, path: defaultSavePath };
    },
  };

  return {
    facade,
    openCalls,
    saveCalls,
    queueOpen(result) {
      openQueue.push(result);
    },
    queueSave(result) {
      saveQueue.push(result);
    },
  };
}
