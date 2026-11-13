import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { DrawRecord } from '@/engine';

export class DrawDatabase extends Dexie {
  draws!: Table<DrawRecord, string>;

  constructor(
    name = 'giveaway-picker',
    options?: ConstructorParameters<typeof Dexie>[1],
  ) {
    super(name, options);
    this.version(1).stores({ draws: 'id, createdAt' });
  }
}
