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
import { DrawDatabase } from '@/db/schema';
import { createDrawRepository } from '@/db/repos';
import { App } from '@/ui/App';
import { createDrawFlow } from '@/store/drawFlow';
import { createSessionStore } from '@/store/session';
import { createHistoryStore } from '@/store/history';
import { createSettingsStore } from '@/store/settings';
import { createDrawConfigStore } from '@/store/drawConfig';

let sequence = 0;
let db: DrawDatabase;
let repo: ReturnType<typeof createDrawRepository>;
let flow: ReturnType<typeof createDrawFlow>;
beforeEach(() => {
  db = new DrawDatabase('t08-ui-' + ++sequence, { indexedDB, IDBKeyRange });
  repo = createDrawRepository(db);
  let id = 0;
  flow = createDrawFlow({
    session: createSessionStore(),
    history: createHistoryStore(repo),
    settings: createSettingsStore(localStorage),
    counts: createDrawConfigStore(),
    now: () => '2026-11-19T00:00:00Z',
    newId: () => 'id-' + ++id,
    rng: { nextUint32: () => 0 },
  });
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  await db.delete();
});
async function enter(text = 'Alice\nBob\nCarol') {
  const field = screen.getByRole('textbox', { name: 'Entrants' });
  fireEvent.paste(field, { clipboardData: { getData: () => text } });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Draw' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
}
async function draw() {
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
  await screen.findByRole('heading', { name: 'Draw results' });
}
async function clickAction(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(flow.getState().busy).toBe(false));
}

test('preparing blocks input and a failed save returns to a retryable input view', async () => {
  let release: () => void = () => {};
  vi.spyOn(repo, 'saveRecord').mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    throw new Error('Storage failed');
  });
  render(<App flow={flow} />);
  await enter();
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
  expect(screen.getByText('Preparing draw…')).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByText('Alice')).toBeNull();
  await waitFor(() => expect(repo.saveRecord).toHaveBeenCalledTimes(1));
  await act(async () => release());
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Storage failed Retry the action when ready.',
  );
  expect(flow.getState().session.getState().draws).toEqual([]);
  await draw();
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(await repo.listRecords()).toHaveLength(1);
});

test('a dirty debounce cannot draw the previous list', async () => {
  render(<App flow={flow} />);
  await enter('Alice');
  const saving = vi.spyOn(repo, 'saveRecord');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bob' } });
  expect(
    (screen.getByRole('button', { name: 'Draw' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
  expect(saving).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(flow.getState().session.getState().build?.entrants[0]?.name).toBe(
      'Bob',
    ),
  );
  await draw();
  expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  expect(screen.queryByText('Alice')).toBeNull();
});

test('one-at-a-time preselects all slots but hides unrevealed names, including in announcements', async () => {
  render(<App flow={flow} />);
  await enter();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Winners' }), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Backups' }), {
    target: { value: '1' },
  });
  fireEvent.click(screen.getByRole('switch', { name: 'Reveal one at a time' }));
  await draw();
  const [saved] = await repo.listRecords();
  expect(saved?.slots.map(({ name }) => name)).toEqual([
    'Alice',
    'Bob',
    'Carol',
  ]);
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(document.body.textContent).not.toContain('Bob');
  expect(document.body.textContent).not.toContain('Carol');
  await clickAction('Mark Alice no-show');
  expect(screen.getByText('Carol')).toBeTruthy();
  expect(document.body.textContent).not.toContain('Bob');
  expect(screen.getByText(/Carol promoted\./).getAttribute('aria-live')).toBe(
    'polite',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  await clickAction('Mark Bob called');
  await clickAction('Undo');
  expect(screen.getByRole('button', { name: 'Mark Bob called' })).toBeTruthy();
  expect(
    (await repo.getRecord(saved?.id ?? ''))?.events.map(({ type }) => type),
  ).toEqual(['DRAWN', 'NO_SHOW', 'PROMOTED', 'CALLED', 'UNDONE']);
});

test('earlier open draws remain reachable, with eligible counts and latest-only undo', async () => {
  render(<App flow={flow} />);
  await enter();
  await draw();
  fireEvent.click(
    screen.getByRole('button', { name: 'Next round / Return to input' }),
  );
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(
    true,
  );
  expect(screen.getByText('2 eligible entrants')).toBeTruthy();
  await draw();
  expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Draw 1' }));
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await clickAction('Mark Alice called');
  fireEvent.click(screen.getByRole('button', { name: 'Draw 2' }));
  await clickAction('Mark Bob called');
  expect(
    (screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Input' }));
  expect(screen.getByText('1 eligible entrants')).toBeTruthy();
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(
    false,
  );
});

test('no-show exhaustion is visible and undo reopens the original winner', async () => {
  render(<App flow={flow} />);
  await enter('Alice');
  await draw();
  await clickAction('Mark Alice no-show');
  expect(screen.getByText('No backup remains for slot 1.')).toBeTruthy();
  await clickAction('Undo');
  expect(screen.queryByText('No backup remains for slot 1.')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Mark Alice called' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Input' }));
  expect(
    (screen.getByRole('button', { name: 'Draw' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByText(/No eligible entrants remain/)).toBeTruthy();
});
