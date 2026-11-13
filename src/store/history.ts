import { createStore } from 'zustand/vanilla';
import { drawRepository } from '@/db/repos';
import type { DrawEvent, DrawRecord } from '@/engine';

export function createHistoryStore(repo = drawRepository) {
  return createStore((set, get: () => HistoryState): HistoryState => {
    let queue = Promise.resolve();
    let pending = 0;

    function run<T>(operation: () => Promise<T>): Promise<T> {
      pending++;
      const result = queue.then(async () => {
        set({ error: null });
        try {
          return await operation();
        } catch (error) {
          set({ error });
          throw error;
        } finally {
          set({ loading: --pending > 0 });
        }
      });
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      set({ loading: true });
      return result;
    }

    function replace(record: DrawRecord) {
      const records = [
        ...get().records.filter(({ id }) => id !== record.id),
        record,
      ];
      records.sort((a, b) =>
        a.createdAt === b.createdAt
          ? a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0
          : a.createdAt > b.createdAt
            ? -1
            : 1,
      );
      set({ records });
      return record;
    }

    return {
      records: [],
      loading: false,
      error: null,
      load: () =>
        run(async () => {
          set({ records: await repo.listRecords() });
        }),
      save: (record) => run(async () => replace(await repo.saveRecord(record))),
      append: (id, events, expectedCount) =>
        run(async () =>
          replace(await repo.appendEvents(id, events, expectedCount)),
        ),
      remove: (id) =>
        run(async () => {
          await repo.deleteRecord(id);
          set({ records: get().records.filter((record) => record.id !== id) });
        }),
      clear: () =>
        run(async () => {
          await repo.clearRecords();
          set({ records: [] });
        }),
    };
  });
}

type HistoryState = {
  records: readonly DrawRecord[];
  loading: boolean;
  error: unknown;
  load(): Promise<void>;
  save(record: DrawRecord): Promise<DrawRecord>;
  append(
    id: string,
    events: readonly DrawEvent[],
    expectedCount: number,
  ): Promise<DrawRecord>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
};

export const historyStore = createHistoryStore();
