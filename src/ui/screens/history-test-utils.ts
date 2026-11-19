import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { DrawDatabase } from '@/db/schema';
import { createDrawRepository } from '@/db/repos';
import { createDrawFlow } from '@/store/drawFlow';
import { createSessionStore } from '@/store/session';
import { createSettingsStore } from '@/store/settings';
import { createDrawConfigStore } from '@/store/drawConfig';
import { createHistoryStore } from '@/store/history';

let sequence = 0;
export function historyFixture() {
  const db = new DrawDatabase('t09-' + ++sequence, { indexedDB, IDBKeyRange });
  const repo = createDrawRepository(db);
  const history = createHistoryStore(repo);
  let id = 0;
  const flow = createDrawFlow({
    history,
    session: createSessionStore(),
    settings: createSettingsStore(localStorage),
    counts: createDrawConfigStore(),
    rng: { nextUint32: () => 0 },
    newId: () => `live-${++id}`,
  });
  return { db, repo, flow, history };
}
