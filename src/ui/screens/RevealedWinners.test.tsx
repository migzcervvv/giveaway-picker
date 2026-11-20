import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import { historyFixture } from './history-test-utils';
import { deriveState } from '@/engine';

let fixture: ReturnType<typeof historyFixture>;
const btn = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const click = (name: string) => fireEvent.click(btn(name));
beforeEach(() => {
  fixture = historyFixture();
  render(<App flow={fixture.flow} />);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  await fixture.db.delete();
});

async function firstBatch(winners: number) {
  const names = Array.from(
    { length: winners + 3 },
    (_, i) => 'Guest-' + String(i).padStart(3, '0'),
  );
  fireEvent.paste(screen.getByRole('textbox'), {
    clipboardData: { getData: () => names.join('\n') },
  });
  await waitFor(() => expect(btn('Audience View').disabled).toBe(false));
  for (const [name, value] of [
    ['Winners', winners],
    ['Backups', 2],
  ] as const) {
    fireEvent.change(screen.getByRole('spinbutton', { name }), {
      target: { value },
    });
  }
  click('Audience View');
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  click('Reveal');
  click('Return to operator');
  const [saved] = await fixture.repo.listRecords();
  if (!saved) throw new Error('Missing saved draw');
  return { names, saved };
}

test.each([7, 30])(
  'manage only the first six of %i winners; resume the same saved order',
  async (n) => {
    const { names, saved } = await firstBatch(n);
    const shown = saved.slots.slice(0, 6).map((s) => s.name);
    function restricted() {
      expect(
        screen
          .getAllByRole('listitem')
          .map((li) => li.querySelector('[dir=auto]')?.textContent),
      ).toEqual(shown);
      for (const name of names.filter((name) => !shown.includes(name)))
        expect(document.body.innerHTML).not.toContain(name);
      expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
    }
    restricted();
    click('Mark ' + shown[0] + ' called');
    await screen.findByText('called');
    click('Mark ' + shown[1] + ' no-show');
    await screen.findByText('no-show');
    restricted();
    const updated = await fixture.repo.getRecord(saved.id);
    if (!updated) throw new Error('Missing updated record');
    expect(updated.slots).toEqual(saved.slots);
    const slots = deriveState(updated.events).slots;
    expect(slots[0]?.status).toBe('called');
    expect(slots[1]?.status).toBe('no_show');
    expect(slots[n]?.status).toBe('promoted');
    expect(slots[n + 1]?.status).toBe('standby');
    click('Undo');
    await waitFor(() => expect(screen.queryByText('no-show')).toBeNull());
    restricted();
    click('Mark ' + shown[1] + ' no-show');
    await screen.findByText('no-show');
    click('Resume Audience View');
    const eligible = slots.slice(0, n + 1);
    for (let start = 6; start < eligible.length; start += 6) {
      for (const slot of slots.slice(start))
        expect(document.body.innerHTML).not.toContain(slot.name);
      click('Reveal next batch');
      expect(
        screen
          .getAllByRole('listitem')
          .map((el) => el.querySelector('[dir=auto]')?.textContent),
      ).toEqual(eligible.slice(start, start + 6).map((s) => s.name));
    }
    expect(await fixture.repo.listRecords()).toHaveLength(1);
  },
);

test('hidden undo target is blocked; persistence errors cannot disclose its name', async () => {
  const { names, saved } = await firstBatch(7);
  await act(async () =>
    fixture.flow.getState().act(saved.id, { type: 'CALLED', rank: 7 }),
  );
  expect(btn('Undo').disabled).toBe(true);
  vi.spyOn(fixture.repo, 'appendEvents').mockRejectedValueOnce(
    new Error(names[6]),
  );
  click('Mark ' + names[0] + ' called');
  await screen.findByRole('alert');
  for (const name of names.slice(6))
    expect(document.body.innerHTML).not.toContain(name);
});

test('pending write blocks duplicate actions and resume, and cannot attach to another generation after unmount', async () => {
  const { names, saved } = await firstBatch(7);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = fixture.repo.appendEvents;
  const write = vi
    .spyOn(fixture.repo, 'appendEvents')
    .mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });
  click('Mark ' + names[0] + ' no-show');
  click('Mark ' + names[0] + ' no-show');
  expect(btn('Resume Audience View').disabled).toBe(true);
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  cleanup();
  const session = fixture.flow.getState().session;
  session.setState({ generation: Symbol(), draws: [] });
  release();
  await waitFor(() => expect(fixture.flow.getState().busy).toBe(false));
  expect(session.getState().draws).toEqual([]);
  const updated = await fixture.repo.getRecord(saved.id);
  expect(
    updated?.events.filter((event) => event.type === 'NO_SHOW'),
  ).toHaveLength(1);
});
