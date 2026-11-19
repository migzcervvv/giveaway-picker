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
import { savedRecord } from '@/io/export/test-utils';
import { App } from '../App';
import { historyFixture } from './history-test-utils';

let fixture: ReturnType<typeof historyFixture>;
beforeEach(() => {
  fixture = historyFixture();
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  await fixture.db.delete();
});
const button = (name: string) => screen.getByRole('button', { name });
function pool() {
  const { session, settings } = fixture.flow.getState();
  session
    .getState()
    .setBuild(
      buildEntrants(['Alice', 'Bob', 'Carol', 'Dana'], settings.getState()),
      session.getState().generation,
    );
  settings.getState().update({ oneAtATime: true });
}
test('unrevealed slots never appear in history, accessible controls or exports until Next completes', async () => {
  pool();
  const { flow } = fixture;
  flow.getState().counts.getState().setWinners(2, 4);
  flow.getState().counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  render(<App flow={flow} />);
  expect((button('History') as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen.getByText('Reveal every selected slot before opening History.'),
  ).toBeTruthy();
  fireEvent.click(button('History'));
  expect(document.body.textContent).not.toContain('Bob');
  expect(document.body.textContent).not.toContain('Carol');
  expect(
    screen.queryByRole('button', { name: /Download|View draw/ }),
  ).toBeNull();
  fireEvent.click(button('Next'));
  expect((button('History') as HTMLButtonElement).disabled).toBe(true);
  expect(document.body.textContent).not.toContain('Carol');
  fireEvent.click(button('Next'));
  expect((button('History') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button('History'));
  fireEvent.click(await screen.findByRole('button', { name: /^View draw/ }));
  expect(
    await screen.findByRole('button', { name: 'Download JSON' }),
  ).toBeTruthy();
  expect(screen.getByText('backup 3: Carol — standby')).toBeTruthy();
});

test('a promoted backup outside the reveal prefix counts as revealed and history refreshes on entry', async () => {
  pool();
  const { flow, repo } = fixture;
  flow.getState().counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  const id = flow.getState().activeId ?? '';
  render(<App flow={flow} />);
  fireEvent.click(button('Mark Alice no-show'));
  await waitFor(() => expect(flow.getState().busy).toBe(false));
  expect(flow.getState().visible[id]).toBe(1);
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  expect((button('History') as HTMLButtonElement).disabled).toBe(false);
  const load = vi.spyOn(repo, 'listRecords');
  fireEvent.click(button('History'));
  fireEvent.click(
    await screen.findByRole('button', { name: `View draw ${id}` }),
  );
  expect(screen.getByText('backup 2: Bob — promoted')).toBeTruthy();
  fireEvent.click(button('Return to raffle'));
  fireEvent.click(button('Mark Bob called'));
  await waitFor(() => expect(flow.getState().busy).toBe(false));
  fireEvent.click(button('History'));
  fireEvent.click(
    await screen.findByRole('button', { name: `View draw ${id}` }),
  );
  expect(screen.getByText('backup 2: Bob — called')).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(2);
});

test('confirmation and retry recheck current session associations rather than trusting an old enabled button', async () => {
  const record = await savedRecord();
  await fixture.repo.saveRecord(record);
  const { flow } = fixture;
  render(<App flow={flow} />);
  fireEvent.click(button('History'));
  fireEvent.click(
    await screen.findByRole('button', { name: `View draw ${record.id}` }),
  );
  fireEvent.click(button('Delete record'));
  vi.spyOn(fixture.repo, 'deleteRecord').mockRejectedValueOnce(
    new Error('Temporary failure'),
  );
  fireEvent.click(button('Confirm deletion'));
  await screen.findByRole('alert');
  await act(async () => {
    const session = flow.getState().session;
    session.getState().setBuild(
      buildEntrants(['A', 'B', 'C', 'D'], {
        dedupe: true,
        foldDiacritics: false,
      }),
      session.getState().generation,
    );
    session.getState().setDraw(record, session.getState().generation);
  });
  fireEvent.click(button('Retry'));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Clear the current session',
    ),
  );
  expect(fixture.repo.deleteRecord).toHaveBeenCalledTimes(1);
  expect(await fixture.repo.getRecord(record.id)).toEqual(record);
});

test.each([false, true])(
  'History preserves pending typing with an existing pool=%s',
  async (existing) => {
    const { session } = fixture.flow.getState();
    if (existing) {
      session.getState().setInput('Old name');
      session
        .getState()
        .setBuild(
          buildEntrants(
            ['Old name'],
            fixture.flow.getState().settings.getState(),
          ),
          session.getState().generation,
        );
    }
    render(<App flow={fixture.flow} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Revised name\nSecond name' },
    });
    expect((button('Draw') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('History'));
    expect(session.getState().build).toBeNull();
    fireEvent.click(button('Return to raffle'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Revised name\nSecond name',
    );
    await waitFor(() =>
      expect((button('Draw') as HTMLButtonElement).disabled).toBe(false),
    );
    expect(
      session.getState().build?.entrants.map((entry) => entry.name),
    ).toEqual(['Revised name', 'Second name']);
    fireEvent.click(button('Draw'));
    await screen.findByRole('heading', { name: 'Draw results' });
    expect(session.getState().draws[0]?.slots[0]?.name).toBe('Revised name');
  },
);
