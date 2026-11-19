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

let fixture: ReturnType<typeof historyFixture>;
const names = ['Juniper', 'Marigold', 'Orchid', 'Clover', 'Azalea'];
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  await fixture.db.delete();
});

async function configure(single = false) {
  expect(btn('Audience View').disabled).toBe(true);
  fireEvent.paste(screen.getByRole('textbox'), {
    clipboardData: { getData: () => names.join('\n') },
  });
  await waitFor(() => expect(btn('Audience View').disabled).toBe(false));
  click('Increase winners');
  click('Increase backups');
  if (single)
    fireEvent.click(
      screen.getByRole('switch', { name: 'Reveal one at a time' }),
    );
  click('Audience View');
}
function privateStage() {
  for (const name of names) expect(document.body.innerHTML).not.toContain(name);
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
}

test('stage stays private across deferred persistence, double Start and early exit', async () => {
  await configure();
  click('Return to operator');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
    names.join('\n'),
  );
  click('Audience View');
  privateStage();
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const save = fixture.repo.saveRecord;
  const write = vi
    .spyOn(fixture.repo, 'saveRecord')
    .mockImplementation(async (record) => {
      await pending;
      return save(record);
    });
  click('Start draw');
  click('Start draw');
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  privateStage();
  expect(btn('Return to operator').disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull();
  await act(async () => release());
  await screen.findByRole('button', { name: 'Reveal' });
  const [saved] = await fixture.repo.listRecords();
  if (!saved) throw new Error('Draw was not persisted');
  privateStage();
  click('Return to operator');
  privateStage();
  click('Resume Audience View');
  privateStage();
  click('Reveal');
  const selected = saved.slots.filter((s) => s.role === 'winner');
  expect(
    screen
      .getAllByRole('listitem')
      .map((el) => el.querySelector('[dir=auto]')?.textContent),
  ).toEqual(selected.map((s) => s.name));
  const winner = selected[0],
    backup = saved.slots.find((s) => s.role === 'backup');
  if (!winner || !backup) throw new Error('Missing fixture slots');
  expect(document.body.innerHTML).not.toContain(backup.name);
  click('Return to operator');
  click('Mark ' + winner.name + ' no-show');
  await screen.findByRole('button', {
    name: 'Mark ' + backup.name + ' called',
  });
  click('Audience View');
  expect(document.body.innerHTML).not.toContain(backup.name);
  click('Reveal next batch');
  expect(screen.getByText(backup.name)).toBeTruthy();
  expect(screen.getByText('no-show')).toBeTruthy();
});

test('one-at-a-time reveal excludes later names and respects the operator history gate', async () => {
  await configure(true);
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  click('Reveal');
  const [saved] = await fixture.repo.listRecords();
  const second = saved?.slots[1];
  if (!second) throw new Error('Missing second winner');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(document.body.innerHTML).not.toContain(second.name);
  click('Reveal next batch');
  expect(screen.getByText(second.name)).toBeTruthy();
  click('Previous page');
  expect(document.body.innerHTML).not.toContain(second.name);
  click('Return to operator');
  expect(btn('History').disabled).toBe(true);
});

test('failed save presents a nameless error and no reveal control', async () => {
  vi.spyOn(fixture.repo, 'saveRecord').mockRejectedValueOnce(
    new Error(names[0]),
  );
  await configure();
  click('Start draw');
  await screen.findByRole('alert');
  privateStage();
  expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull();
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  privateStage();
});

function motion(reduced = false) {
  const preference = Object.assign(new EventTarget(), { matches: reduced });
  vi.stubGlobal('matchMedia', () => preference);
  return preference;
}
test('face-down batch contains no names; timer and Skip disclose each saved batch once', async () => {
  motion();
  const audio = vi.fn();
  vi.stubGlobal('AudioContext', audio);
  await configure(true);
  click('Mute');
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  const [saved] = await fixture.repo.listRecords();
  const [first, second] = saved?.slots ?? [];
  if (!first || !second) throw new Error('Missing fixture slots');
  vi.useFakeTimers();
  click('Reveal');
  fireEvent.click(btn('Skip'), { detail: 2 });
  privateStage();
  expect(btn('Skip')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1999));
  privateStage();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText(first.name)).toBeTruthy();
  expect(document.body.innerHTML).not.toContain(second.name);
  click('Reveal next batch');
  expect(document.body.innerHTML).not.toContain(second.name);
  click('Skip');
  expect(screen.getByText(second.name)).toBeTruthy();
  expect(document.querySelector('[data-celebrate]')).toBeNull();
  act(() => vi.runAllTimers());
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(audio).not.toHaveBeenCalled();
});

test('exit cancels the shuffle; a live motion preference change finishes it immediately', async () => {
  const preference = motion();
  await configure();
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  vi.useFakeTimers();
  click('Reveal');
  click('Return to operator');
  act(() => vi.advanceTimersByTime(3000));
  privateStage();
  click('Resume Audience View');
  privateStage();
  click('Reveal');
  act(() => {
    preference.matches = true;
    preference.dispatchEvent(new Event('change'));
  });
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(document.querySelector('[data-celebrate]')).toBeNull();
});

test('unmount during shuffle clears its timer and motion listener', async () => {
  const preference = motion();
  const remove = vi.spyOn(preference, 'removeEventListener');
  await configure();
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  vi.useFakeTimers();
  click('Reveal');
  cleanup();
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});
test('reduced motion reveals immediately, without opening an audio context', async () => {
  motion(true);
  const audio = vi.fn();
  vi.stubGlobal('AudioContext', audio);
  await configure();
  click('Start draw');
  await screen.findByRole('button', { name: 'Reveal' });
  click('Reveal');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(
    document.querySelector('.mystery-ticket, [data-celebrate]'),
  ).toBeNull();
  expect(audio).not.toHaveBeenCalled();
});
