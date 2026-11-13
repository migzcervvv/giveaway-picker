import { hashEntrants } from './hash';
import { deriveState, slotsFromResult } from './lifecycle';
import type { DrawEvent, Slot, SlotStatus } from './lifecycle';
import { NORMALIZATION_VERSION } from './normalize';
import type { BuildStats, DrawConfig, DrawResult, Entrant } from './types';

type RecordConfig = DrawConfig & {
  dedupe: boolean;
  foldDiacritics: boolean;
  removeCalled: boolean;
};

export type DrawRecord = Readonly<{
  id: string;
  createdAt: string;
  entrantCount: number;
  rawCount: number;
  blankDropped: number;
  duplicatesRemoved: number;
  listHash: string;
  normalizationVersion: number;
  config: Readonly<RecordConfig>;
  slots: readonly Readonly<Slot>[];
  events: readonly Readonly<DrawEvent>[];
}>;

export type ExportSchemaVersion = 1;
type Row = Record<string, string>;
type RecordInput = {
  id: string;
  createdAt: string;
  buildStats: BuildStats;
  entrants: readonly Entrant[];
  config: RecordConfig;
  result: DrawResult;
  events: readonly DrawEvent[];
};

function copyConfig({
  winners,
  backups,
  dedupe,
  foldDiacritics,
  removeCalled,
}: RecordConfig) {
  return { winners, backups, dedupe, foldDiacritics, removeCalled };
}

function copySlot({ rank, role, entrantId, name }: Slot): Slot {
  return { rank, role, entrantId, name };
}

function copyEvent(event: Readonly<DrawEvent>): DrawEvent {
  const { id, at, type } = event;
  switch (type) {
    case 'DRAWN': {
      const slots = event.slots.map((slot) => Object.freeze(copySlot(slot)));
      Object.freeze(slots);
      return { id, at, type, slots };
    }
    case 'CALLED':
    case 'NO_SHOW':
      return { id, at, type, rank: event.rank };
    case 'PROMOTED':
      return {
        id,
        at,
        type,
        backupRank: event.backupRank,
        replacesRank: event.replacesRank,
      };
    case 'EXHAUSTED':
      return { id, at, type, replacesRank: event.replacesRank };
    case 'UNDONE':
      return { id, at, type, targetEventId: event.targetEventId };
  }
}

export async function buildDrawRecord(input: RecordInput): Promise<DrawRecord> {
  const { id, createdAt, buildStats, entrants, config, result, events } = input;
  const snapshot = {
    id,
    createdAt,
    entrantCount: buildStats.finalCount,
    rawCount: buildStats.rawCount,
    blankDropped: buildStats.blankDropped,
    duplicatesRemoved: buildStats.duplicatesRemoved,
    normalizationVersion: NORMALIZATION_VERSION,
    config: Object.freeze(copyConfig(config)),
    slots: Object.freeze(
      slotsFromResult(result).map((slot) => Object.freeze(slot)),
    ),
    events: Object.freeze(
      events.map((event) => Object.freeze(copyEvent(event))),
    ),
  };
  return Object.freeze({ ...snapshot, listHash: await hashEntrants(entrants) });
}

function countsFrom({
  entrantCount,
  rawCount,
  blankDropped,
  duplicatesRemoved,
}: DrawRecord) {
  return { entrantCount, rawCount, blankDropped, duplicatesRemoved };
}

function finalStatuses(record: DrawRecord): Record<number, SlotStatus> {
  const { slots } = deriveState(record.events);
  const statuses = new Map(slots.map(({ rank, status }) => [rank, status]));
  return Object.fromEntries(
    record.slots.map(({ rank, role }) => [
      rank,
      statuses.get(rank) ?? (role === 'winner' ? 'pending' : 'standby'),
    ]),
  );
}

export function toExportJson(record: DrawRecord): string {
  const schema: ExportSchemaVersion = 1;
  return JSON.stringify(
    {
      schema,
      drawId: record.id,
      createdAt: record.createdAt,
      listHash: record.listHash,
      hashAlgo: 'sha256',
      normalizationVersion: record.normalizationVersion,
      counts: countsFrom(record),
      config: copyConfig(record.config),
      slots: record.slots.map(copySlot),
      events: record.events.map(copyEvent),
      finalStatus: finalStatuses(record),
    },
    null,
    2,
  );
}

function safeRow(cells: Record<string, string | number | boolean>): Row {
  return Object.fromEntries(
    Object.entries(cells).map(([key, value]) => {
      const text = String(value);
      // Tab and CR are formula triggers even without a leading operator.
      return [key, /^[=+@\t\r-]/u.test(text) ? `'${text}` : text];
    }),
  );
}

export function toExportRows(record: DrawRecord): {
  slots: Row[];
  events: Row[];
  summary: Row[];
} {
  const statuses = finalStatuses(record);
  return {
    slots: record.slots.map(({ rank, role, name }) =>
      safeRow({ rank, role, name, finalStatus: statuses[rank] ?? '' }),
    ),
    events: record.events.map((event) =>
      safeRow({
        id: event.id,
        at: event.at,
        type: event.type,
        rank: 'rank' in event ? event.rank : '',
        backupRank: 'backupRank' in event ? event.backupRank : '',
        replacesRank: 'replacesRank' in event ? event.replacesRank : '',
        targetEventId: 'targetEventId' in event ? event.targetEventId : '',
        slots:
          event.type === 'DRAWN'
            ? JSON.stringify(event.slots.map(copySlot))
            : '',
      }),
    ),
    summary: [
      safeRow({
        drawId: record.id,
        createdAt: record.createdAt,
        listHash: record.listHash,
        hashAlgo: 'sha256',
        normalizationVersion: record.normalizationVersion,
        ...countsFrom(record),
        ...copyConfig(record.config),
      }),
    ],
  };
}
