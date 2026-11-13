import type { DrawEvent, DrawRecord, Slot } from '@/engine';
import { DrawDatabase } from './schema';

export class DrawRepositoryError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_RECORD'
      | 'NOT_FOUND'
      | 'STALE_COUNT'
      | 'DUPLICATE_EVENT'
      | 'UNEXPECTED_DRAWN',
  ) {
    super(code);
    this.name = 'DrawRepositoryError';
  }
}

function requireValid(condition: boolean): asserts condition {
  if (!condition) throw new DrawRepositoryError('INVALID_RECORD');
}

function copySlot({ rank, role, entrantId, name }: Slot): Slot {
  requireValid(
    Number.isSafeInteger(rank) &&
      rank > 0 &&
      (role === 'winner' || role === 'backup') &&
      typeof entrantId === 'string' &&
      typeof name === 'string',
  );
  return { rank, role, entrantId, name };
}

function copyEvent(event: Readonly<DrawEvent>): DrawEvent {
  const { id, at, type } = event;
  requireValid(typeof id === 'string' && typeof at === 'string');
  switch (type) {
    case 'DRAWN':
      requireValid(Array.isArray(event.slots));
      return { id, at, type, slots: Array.from(event.slots, copySlot) };
    case 'CALLED':
    case 'NO_SHOW':
      requireValid(Number.isSafeInteger(event.rank));
      return { id, at, type, rank: event.rank };
    case 'PROMOTED':
      requireValid(
        Number.isSafeInteger(event.backupRank) &&
          Number.isSafeInteger(event.replacesRank),
      );
      return {
        id,
        at,
        type,
        backupRank: event.backupRank,
        replacesRank: event.replacesRank,
      };
    case 'EXHAUSTED':
      requireValid(Number.isSafeInteger(event.replacesRank));
      return { id, at, type, replacesRank: event.replacesRank };
    case 'UNDONE':
      requireValid(typeof event.targetEventId === 'string');
      return { id, at, type, targetEventId: event.targetEventId };
    default:
      throw new DrawRepositoryError('INVALID_RECORD');
  }
}

function projectRecord(record: DrawRecord): DrawRecord {
  const {
    id,
    createdAt,
    entrantCount,
    rawCount,
    blankDropped,
    duplicatesRemoved,
    listHash,
    normalizationVersion,
    config,
    slots,
    events,
  } = record;
  requireValid(Array.isArray(slots) && Array.isArray(events) && !!config);
  const { winners, backups, dedupe, foldDiacritics, removeCalled } = config;
  requireValid(
    [id, createdAt, listHash].every((value) => typeof value === 'string') &&
      [
        entrantCount,
        rawCount,
        blankDropped,
        duplicatesRemoved,
        normalizationVersion,
        winners,
        backups,
      ].every((value) => Number.isSafeInteger(value) && value >= 0) &&
      [dedupe, foldDiacritics, removeCalled].every(
        (value) => typeof value === 'boolean',
      ),
  );

  return {
    id,
    createdAt,
    entrantCount,
    rawCount,
    blankDropped,
    duplicatesRemoved,
    listHash,
    normalizationVersion,
    config: { winners, backups, dedupe, foldDiacritics, removeCalled },
    slots: Array.from(slots, copySlot),
    events: Array.from(events, copyEvent),
  };
}

function checkNewIds(events: readonly DrawEvent[], ids = new Set<string>()) {
  for (const { id } of events) {
    if (ids.has(id)) throw new DrawRepositoryError('DUPLICATE_EVENT');
    ids.add(id);
  }
}

export function createDrawRepository(db: DrawDatabase) {
  return {
    async saveRecord(record: DrawRecord): Promise<DrawRecord> {
      const projected = projectRecord(record);
      const [initial, ...later] = projected.events;
      requireValid(
        initial?.type === 'DRAWN' &&
          JSON.stringify(initial.slots) === JSON.stringify(projected.slots) &&
          later.every(({ type }) => type !== 'DRAWN'),
      );
      checkNewIds(projected.events);
      await db.draws.add(projected);
      return projected;
    },
    async getRecord(id: string): Promise<DrawRecord | undefined> {
      const record = await db.draws.get(id);
      return record && projectRecord(record);
    },
    async listRecords(): Promise<DrawRecord[]> {
      const records = await db.draws.orderBy('createdAt').reverse().toArray();
      return records
        .sort((a, b) => {
          if (a.createdAt !== b.createdAt)
            return a.createdAt > b.createdAt ? -1 : 1;
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        })
        .map(projectRecord);
    },
    async appendEvents(
      id: string,
      appended: readonly DrawEvent[],
      expectedEventCount: number,
    ): Promise<DrawRecord> {
      const batch = Array.from(appended, copyEvent);
      return db.transaction('rw', db.draws, async () => {
        const stored = await db.draws.get(id);
        if (!stored) throw new DrawRepositoryError('NOT_FOUND');
        const record = projectRecord(stored);
        if (record.events.length !== expectedEventCount)
          throw new DrawRepositoryError('STALE_COUNT');
        if (batch.some(({ type }) => type === 'DRAWN'))
          throw new DrawRepositoryError('UNEXPECTED_DRAWN');
        checkNewIds(batch, new Set(record.events.map(({ id }) => id)));

        const updated = { ...record, events: [...record.events, ...batch] };
        if (batch.length > 0) await db.draws.put(updated);
        return updated;
      });
    },
    async deleteRecord(id: string): Promise<void> {
      await db.draws.delete(id);
    },
    async clearRecords(): Promise<void> {
      await db.draws.clear();
    },
  };
}

export const drawRepository = createDrawRepository(new DrawDatabase());
