import type { HostSystemsFacade } from "@vela/api";

export type CreateMockFsSysOptions = {
  /** Seed relative path → contents. */
  readonly files?: Readonly<Record<string, string>>;
};

export type MockFsWriteRecord = {
  readonly path: string;
  readonly data: string;
};

/**
 * In-memory app-sandbox fs facade for unit tests and browser dogfood.
 * Keys are app-relative paths (same form as `fs.read` / `fs.write` args after normalize).
 */
export function createMockFsSys(options: CreateMockFsSysOptions = {}): {
  readonly facade: NonNullable<HostSystemsFacade["fs"]>;
  readonly files: Map<string, string>;
  readonly reads: string[];
  readonly writes: MockFsWriteRecord[];
} {
  const files = new Map<string, string>(Object.entries(options.files ?? {}));
  const reads: string[] = [];
  const writes: MockFsWriteRecord[] = [];

  const facade: NonNullable<HostSystemsFacade["fs"]> = {
    async readText(path) {
      reads.push(path);
      const data = files.get(path);
      if (data === undefined) {
        throw new Error(`fs.read: not found: ${path}`);
      }
      return data;
    },
    async writeText(path, data) {
      writes.push({ path, data });
      files.set(path, data);
    },
  };

  return { facade, files, reads, writes };
}
