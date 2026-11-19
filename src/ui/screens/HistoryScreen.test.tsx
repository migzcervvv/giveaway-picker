import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import { buildEntrants, eligiblePool } from '@/engine';
import { savedRecord } from '@/io/export/test-utils';
import * as exports from '@/io/export/record';
import { historyFixture } from './history-test-utils';

let fixture: ReturnType<typeof historyFixture>;
beforeEach(() => {
  fixture = historyFixture();
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  await fixture.db.delete();
});
const button = (name: string) => screen.getByRole('button', { name });
async function open() {
  render(<App flow={fixture.flow} />);
  fireEvent.click(button('History'));
  await waitFor(() => expect(fixture.history.getState().loading).toBe(false));
}
async function detail(id = 'archive-a') {
  fireEvent.click(
    await screen.findByRole('button', { name: `View draw ${id}` }),
  );
}
async function confirm() {
  fireEvent.click(button('Confirm deletion'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

test('fresh-session history loads sorted records and full read-only detail without changing eligibility', async () => {
  const { repo, flow } = fixture;
  const a = await savedRecord({
    actions: true,
    names: [
      '<img src=x onerror=alert(1)>',
      'Bob',
      'Carol',
      'Dana',
      'Unselected',
    ],
  });
  const b = await savedRecord({
    id: 'archive-b',
    createdAt: '2026-11-20T00:00:00Z',
  });
  await repo.saveRecord(a);
  await repo.saveRecord(b);
  const session = flow.getState().session;
  const pool = buildEntrants(['Fresh Alice', 'Fresh Bob'], {
    dedupe: true,
    foldDiacritics: false,
  });
  session.getState().setInput('Fresh Alice\nFresh Bob');
  session.getState().setBuild(pool, session.getState().generation);
  const before = session.getState();
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const network = vi.spyOn(globalThis, 'fetch');
  await open();
  const links = screen.getAllByRole('button', { name: /^View draw/ });
  expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
    'View draw archive-b',
    'View draw archive-a',
  ]);
  await detail();
  expect(screen.getByText(a.listHash)).toBeTruthy();
  const region = within(screen.getByRole('region', { name: 'Draw record' }));
  expect(region.getByText('Archived record — read only')).toBeTruthy();
  expect(
    region.getByText(/winner 1: <img src=x onerror=alert\(1\)> — no_show/),
  ).toBeTruthy();
  expect(region.getByText('winner 2: Bob — called')).toBeTruthy();
  expect(region.getByText('backup 4: Dana — promoted')).toBeTruthy();
  expect(region.getByText(/"type":"EXHAUSTED"/)).toBeTruthy();
  expect(region.getByText(/"type":"UNDONE"/)).toBeTruthy();
  expect(region.queryByRole('button', { name: /Mark|Undo/ })).toBeNull();
  expect(document.querySelector('img')).toBeNull();
  expect(document.body.textContent).not.toContain('Unselected');
  expect(session.getState()).toBe(before);
  expect(
    eligiblePool(
      pool.entrants,
      session.getState().draws.map((draw) => draw.events),
      { removeCalled: true },
    ),
  ).toEqual(pool.entrants);
  expect(storage).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

test('load exposes loading, error, Retry and empty states', async () => {
  let reject: (error: Error) => void = () => {};
  vi.spyOn(fixture.repo, 'listRecords').mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(<App flow={fixture.flow} />);
  fireEvent.click(button('History'));
  expect(screen.getByText('Working on history…')).toBeTruthy();
  await act(async () => {
    await Promise.resolve();
    reject(new Error('Database unavailable'));
  });
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Database unavailable Retry',
  );
  fireEvent.click(button('Retry'));
  expect(await screen.findByText('No saved draws.')).toBeTruthy();
});

test('delete cancel/failure/retry commits only after confirmation and survives reload', async () => {
  const record = await savedRecord();
  await fixture.repo.saveRecord(record);
  await open();
  await detail();
  fireEvent.click(button('Delete record'));
  fireEvent.click(button('Cancel'));
  expect(await fixture.repo.getRecord(record.id)).toEqual(record);
  const deletion = vi
    .spyOn(fixture.repo, 'deleteRecord')
    .mockRejectedValueOnce(new Error('Delete failed'));
  fireEvent.click(button('Delete record'));
  fireEvent.click(button('Confirm deletion'));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Delete failed Retry',
  );
  expect(fixture.history.getState().records).toHaveLength(1);
  fireEvent.click(button('Retry'));
  await screen.findByText('No saved draws.');
  expect(deletion).toHaveBeenCalledTimes(2);
  await fixture.history.getState().load();
  expect(fixture.history.getState().records).toEqual([]);
});

test('clear all cancel/failure/retry removes only draw records and preserves settings', async () => {
  await fixture.repo.saveRecord(await savedRecord());
  await fixture.repo.saveRecord(await savedRecord({ id: 'archive-b' }));
  fixture.flow.getState().settings.getState().update({ soundEnabled: false });
  fixture.flow.getState().session.getState().setInput('Private input remains');
  const session = fixture.flow.getState().session.getState();
  const stored = localStorage.getItem('giveaway-picker-settings');
  await open();
  fireEvent.click(button('Clear all history'));
  fireEvent.click(button('Cancel'));
  expect(await fixture.repo.listRecords()).toHaveLength(2);
  vi.spyOn(fixture.repo, 'clearRecords').mockRejectedValueOnce(
    new Error('Clear failed'),
  );
  fireEvent.click(button('Clear all history'));
  fireEvent.click(button('Confirm deletion'));
  await screen.findByRole('alert');
  expect(await fixture.repo.listRecords()).toHaveLength(2);
  fireEvent.click(button('Retry'));
  await screen.findByText('No saved draws.');
  await fixture.history.getState().load();
  expect(fixture.history.getState().records).toEqual([]);
  expect(localStorage.getItem('giveaway-picker-settings')).toBe(stored);
  expect(fixture.flow.getState().session.getState()).toBe(session);
});

test.each([false, true])(
  'linked records (resolved=%s) cannot be deleted, but unrelated archive deletion preserves pool generation and draws',
  async (resolved) => {
    const { flow, repo } = fixture;
    await repo.saveRecord(await savedRecord());
    const session = flow.getState().session;
    session
      .getState()
      .setBuild(
        buildEntrants(['A', 'B', 'C'], { dedupe: true, foldDiacritics: false }),
        session.getState().generation,
      );
    await flow.getState().start(true);
    if (resolved)
      await flow
        .getState()
        .act(flow.getState().activeId ?? '', { type: 'CALLED', rank: 1 });
    const before = session.getState();
    await open();
    expect((button('Clear all history') as HTMLButtonElement).disabled).toBe(
      true,
    );
    await detail(before.draws[0]?.id);
    expect((button('Delete record') as HTMLButtonElement).disabled).toBe(true);
    await detail();
    fireEvent.click(button('Delete record'));
    await confirm();
    expect(session.getState()).toBe(before);
    expect(await repo.listRecords()).toHaveLength(1);
  },
);

test('export errors are visible and retryable for the exact selected persisted record', async () => {
  const record = await savedRecord({ actions: true });
  await fixture.repo.saveRecord(record);
  const download = vi
    .spyOn(exports, 'downloadRecord')
    .mockRejectedValueOnce(new Error('Download blocked'))
    .mockResolvedValueOnce();
  await open();
  await detail();
  fireEvent.click(button('Download XLSX'));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Download blocked Retry',
  );
  fireEvent.click(button('Retry'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(download).toHaveBeenNthCalledWith(1, record, 'xlsx');
  expect(download).toHaveBeenNthCalledWith(2, record, 'xlsx');
});

test('exhaustion detail is derived from the persisted log and busy preparation blocks History', async () => {
  const record = await savedRecord({ actions: true });
  await fixture.repo.saveRecord({
    ...record,
    events: record.events.slice(0, -1),
  });
  await open();
  await detail();
  expect(screen.getByText('No backup remains for slot 4.')).toBeTruthy();
  await act(async () => {
    fixture.flow.setState({ busy: true });
  });
  expect((button('History') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Delete record' })).toBeNull();
  expect(screen.getByText('Preparing draw…')).toBeTruthy();
});

test('canceling a failed deletion removes the destructive Retry action', async () => {
  const record = await savedRecord();
  await fixture.repo.saveRecord(record);
  vi.spyOn(fixture.repo, 'deleteRecord').mockRejectedValueOnce(
    new Error('Temporary failure'),
  );
  await open();
  await detail();
  fireEvent.click(button('Delete record'));
  fireEvent.click(button('Confirm deletion'));
  await screen.findByRole('alert');
  fireEvent.click(button('Cancel'));
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(await fixture.repo.getRecord(record.id)).toEqual(record);
});
