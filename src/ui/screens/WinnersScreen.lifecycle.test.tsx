import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildEntrants } from '@/engine';
import type { BuildRequest, BuildResponse } from '@/io/build/protocol';
import { DrawDatabase } from '@/db/schema';
import { createDrawRepository } from '@/db/repos';
import { createDrawFlow } from '@/store/drawFlow';
import { createSessionStore } from '@/store/session';
import { createHistoryStore } from '@/store/history';
import { createSettingsStore } from '@/store/settings';
import { createDrawConfigStore } from '@/store/drawConfig';
import { App } from '@/ui/App';

let sequence = 0;
let db: DrawDatabase;
let repo: ReturnType<typeof createDrawRepository>;
let flow: ReturnType<typeof createDrawFlow>;
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  db = new DrawDatabase('t08-lifecycle-' + ++sequence, {
    indexedDB,
    IDBKeyRange,
  });
  repo = createDrawRepository(db);
  let id = 0;
  flow = createDrawFlow({
    session: createSessionStore(),
    history: createHistoryStore(repo),
    settings: createSettingsStore(localStorage),
    counts: createDrawConfigStore(),
    newId: () => 'id-' + ++id,
    rng: { nextUint32: () => 0 },
  });
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  await db.delete();
});
const drawButton = () =>
  screen.getByRole('button', { name: 'Draw' }) as HTMLButtonElement;
async function enter(text: string) {
  fireEvent.paste(screen.getByRole('textbox'), {
    clipboardData: { getData: () => text },
  });
  await waitFor(() => expect(drawButton().disabled).toBe(false));
}
async function draw() {
  fireEvent.click(drawButton());
  await screen.findByRole('heading', { name: 'Draw results' });
}

test.each(['dedupe', 'foldDiacritics'] as const)(
  'interrupted %s worker rebuild restarts before the pool is drawable',
  async (setting) => {
    const workers: ControlledWorker[] = [];
    class ControlledWorker {
      onmessage: ((event: { data: BuildResponse }) => void) | null = null;
      onerror = null;
      request?: BuildRequest;
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
      postMessage(request: BuildRequest) {
        this.request = request;
        if (workers.length === 1) queueMicrotask(() => this.finish());
      }
      finish() {
        const request = this.request;
        if (!request) throw new Error('No worker request');
        this.onmessage?.({
          data: {
            id: request.id,
            ok: true,
            result: buildEntrants(request.names, request),
          },
        });
      }
    }
    vi.stubGlobal('Worker', ControlledWorker);
    render(<App flow={flow} />);
    await enter(
      Array.from({ length: 5002 }, (_, index) =>
        index % 2 ? 'Jose' : 'José',
      ).join('\n'),
    );
    await draw();
    fireEvent.click(screen.getByRole('button', { name: 'Mark José called' }));
    await waitFor(() => expect(flow.getState().busy).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Input' }));
    const label =
      setting === 'dedupe'
        ? 'Remove duplicate names'
        : 'Ignore accents when comparing';
    fireEvent.click(screen.getByRole('switch', { name: label }));
    await waitFor(() => expect(workers).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Draw 1' }));
    expect(workers[1]?.terminate).toHaveBeenCalledTimes(1);
    // A stale caller-supplied UI flag must not bypass the orchestrator's freshness check.
    await act(async () => flow.getState().start(true));
    expect(flow.getState().error).toContain('finish building');
    expect(await repo.listRecords()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Input' }));
    await waitFor(() => expect(workers).toHaveLength(3));
    expect(drawButton().disabled).toBe(true);
    expect(flow.getState().session.getState().build?.stats.finalCount).toBe(2);
    await act(async () => workers[2]?.finish());
    await waitFor(() => expect(drawButton().disabled).toBe(false));
    const expectedCount = setting === 'dedupe' ? 5002 : 1;
    expect(flow.getState().session.getState().build?.stats.finalCount).toBe(
      expectedCount,
    );
    await draw();
    const selected = flow.getState().session.getState().draws[0];
    expect(selected?.entrantCount).toBe(expectedCount);
    expect(selected?.config).toMatchObject({
      dedupe: setting !== 'dedupe',
      foldDiacritics: setting === 'foldDiacritics',
    });
    expect((await repo.getRecord(selected?.id ?? ''))?.config).toEqual(
      selected?.config,
    );
  },
);

test('clipboard completion after draw begins cannot change the pool or detach the saved result', async () => {
  const clipboard = deferred<string>();
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, {
      userAgent: { value: navigator.userAgent },
      clipboard: { value: { readText: () => clipboard.promise } },
    }),
  );
  const saving = deferred<void>();
  const original = repo.saveRecord;
  const save = vi
    .spyOn(repo, 'saveRecord')
    .mockImplementationOnce(async (record) => {
      await saving.promise;
      return original(record);
    });
  render(<App flow={flow} />);
  await enter('Alice\nBob');
  const before = flow.getState().session.getState();
  fireEvent.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
  fireEvent.click(drawButton());
  expect(screen.queryByRole('textbox')).toBeNull();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await act(async () => clipboard.resolve('Unselected replacement'));
  expect(flow.getState().session.getState()).toBe(before);
  expect(flow.getState().busy).toBe(true);
  await act(async () => saving.resolve());
  await waitFor(() => expect(flow.getState().busy).toBe(false));
  expect(flow.getState().error).toBeNull();
  await screen.findByRole('heading', { name: 'Draw results' });
  const after = flow.getState().session.getState();
  expect(after.generation).toBe(before.generation);
  expect(after.rawText).toBe('Alice\nBob');
  expect(after.build).toBe(before.build);
  expect(after.draws).toHaveLength(1);
  expect(after.draws[0]?.slots[0]?.name).toBe('Alice');
  expect(flow.getState().error).toBeNull();
  expect(await repo.getRecord(after.draws[0]?.id ?? '')).toEqual(
    after.draws[0],
  );
});

test.each(['resolve', 'reject'])(
  'retired clipboard %s is ignored after unmount',
  async (completion) => {
    let resolve: (value: string) => void = () => {};
    let reject: (error: Error) => void = () => {};
    const promise = new Promise<string>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    vi.stubGlobal(
      'navigator',
      Object.create(navigator, {
        userAgent: { value: navigator.userAgent },
        clipboard: { value: { readText: () => promise } },
      }),
    );
    const view = render(<App flow={flow} />);
    await enter('Alice');
    fireEvent.click(
      screen.getByRole('button', { name: 'Paste from clipboard' }),
    );
    const before = flow.getState().session.getState();
    view.unmount();
    await act(async () => {
      if (completion === 'resolve') resolve('Retired input');
      else reject(new Error('Permission denied'));
    });
    expect(flow.getState().session.getState()).toBe(before);
  },
);
