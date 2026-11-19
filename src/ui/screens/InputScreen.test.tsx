import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { applyAction, buildDrawRecord, slotsFromResult } from '@/engine';
import type { BuildResult } from '@/engine';
import { createBuildRunner } from '@/io/build/runner';
import type { BuildRunner } from '@/io/build/runner';
import { createDrawConfigStore } from '@/store/drawConfig';
import { createSessionStore } from '@/store/session';
import { createSettingsStore } from '@/store/settings';
import { InputScreen } from './InputScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});
function setup(runner: BuildRunner = createBuildRunner()) {
  const session = createSessionStore();
  const settings = createSettingsStore(localStorage);
  const counts = createDrawConfigStore();
  const view = render(
    <InputScreen
      session={session}
      settings={settings}
      counts={counts}
      runner={runner}
    />,
  );
  return { session, settings, counts, ...view };
}
function paste(text: string) {
  const field = screen.getByRole('textbox', { name: 'Entrants' });
  fireEvent.paste(field, { clipboardData: { getData: () => text } });
}
const summary = () =>
  within(screen.getByRole('region', { name: 'List summary' }));

test('paste builds summary, first five names, and duplicate counts without storing entrants', async () => {
  const { session } = setup();
  paste('Alice\nBob\nCarol\nDana\nEve\nFrank\nalice\n');
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(6),
  );
  expect(summary().getByText('8')).toBeTruthy();
  expect(summary().getAllByText('1')).toHaveLength(2);
  expect(summary().getByText('6')).toBeTruthy();
  expect(summary().getByText('Eve')).toBeTruthy();
  expect(summary().queryByText('Frank')).toBeNull();
  expect(summary().getByText('Alice × 1')).toBeTruthy();
  expect(localStorage.getItem('giveaway-picker-settings') ?? '').not.toContain(
    'Alice',
  );
  expect(sessionStorage.length).toBe(0);
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  expect(textarea.getAttribute('spellcheck')).toBe('false');
  expect(textarea.getAttribute('autocomplete')).toBe('off');
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(summary().getByText('No names yet')).toBeTruthy());
});

test('dedupe and accent switches rebuild the summary and store only preferences', async () => {
  const { session } = setup();
  paste('José\nJose\nJosé');
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(2),
  );
  fireEvent.click(
    screen.getByRole('switch', { name: 'Ignore accents when comparing' }),
  );
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(1),
  );
  fireEvent.click(
    screen.getByRole('switch', { name: 'Remove duplicate names' }),
  );
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(3),
  );
  const stored = JSON.parse(
    localStorage.getItem('giveaway-picker-settings') ?? '{}',
  );
  expect(Object.keys(stored.state).sort()).toEqual(
    [
      'soundEnabled',
      'revealMode',
      'theme',
      'dedupe',
      'foldDiacritics',
      'removeCalled',
      'oneAtATime',
    ].sort(),
  );
  expect(JSON.stringify(stored)).not.toContain('José');
});

test('counts clamp on direct edits and on pool changes with explanatory feedback', async () => {
  const { session, counts } = setup();
  paste('A\nB\nC\nD');
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(4),
  );
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Backups' }), {
    target: { value: '3' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Winners' }), {
    target: { value: '3' },
  });
  expect(counts.getState()).toMatchObject({ winners: 3, backups: 1 });
  expect(
    screen.getByText('Counts adjusted to fit the entrant pool.'),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Winners' }), {
    target: { value: '99' },
  });
  expect(counts.getState()).toMatchObject({ winners: 4, backups: 0 });
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  field.setSelectionRange(0, field.value.length);
  paste('A\nB');
  await waitFor(() =>
    expect(counts.getState()).toMatchObject({ winners: 2, backups: 0 }),
  );
});

test('unresolved draw locks input and rebuild switches with an announced reason', async () => {
  const { session } = setup();
  paste('A\nB');
  await waitFor(() =>
    expect(session.getState().build?.stats.finalCount).toBe(2),
  );
  const build = session.getState().build;
  if (!build) throw new Error('Expected build');
  const result = {
    winners: build.entrants.slice(0, 1),
    backups: build.entrants.slice(1),
  };
  const at = '2026-11-19T00:00:00Z';
  const record = await buildDrawRecord({
    id: 'draw',
    createdAt: at,
    buildStats: build.stats,
    entrants: build.entrants,
    config: {
      winners: 1,
      backups: 1,
      dedupe: true,
      foldDiacritics: false,
      removeCalled: true,
    },
    result,
    events: [
      { id: 'drawn', at, type: 'DRAWN', slots: slotsFromResult(result) },
    ],
  });
  act(() => session.getState().setDraw(record, session.getState().generation));
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  expect(field.readOnly).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (const name of [
    'Remove duplicate names',
    'Ignore accents when comparing',
  ])
    expect(
      (screen.getByRole('switch', { name }) as HTMLInputElement).disabled,
    ).toBe(true);
  expect(
    (
      screen.getByRole('switch', {
        name: 'Remove winners from the pool after they are called',
      }) as HTMLInputElement
    ).disabled,
  ).toBe(false);
  const explanation = screen.getByText(
    'Mark every winner as called or no-show before changing the list.',
  );
  expect(field.getAttribute('aria-describedby')).toBe(explanation.id);
  expect(explanation.getAttribute('role')).toBe('status');
  paste('new');
  expect(field.value).toBe('A\nB');
  const events = [
    ...record.events,
    ...applyAction(
      record.events,
      { type: 'CALLED', rank: 1 },
      at,
      () => 'called',
    ),
  ];
  act(() =>
    session
      .getState()
      .setDraw({ ...record, events }, session.getState().generation),
  );
  expect(field.readOnly).toBe(false);
});

test('names render as text, duplicate lists cap at 200, and tabular input is explained', async () => {
  const { session, container } = setup();
  const names = Array.from({ length: 205 }, (_, i) => 'Name ' + i);
  const markup = '<img src=x onerror=alert(1)>';
  paste([markup, ...names, ...names].join('\n'));
  await waitFor(() =>
    expect(session.getState().build?.duplicates).toHaveLength(205),
  );
  expect(screen.getByText(markup)).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('+5 more')).toBeTruthy();
  expect(container.querySelectorAll('details li')).toHaveLength(200);
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  field.setSelectionRange(0, field.value.length);
  paste('A\tB\nC\tD');
  expect(
    screen.getByText(
      'Several columns detected. Each line is used as one name, including text after the tab.',
    ),
  ).toBeTruthy();
});

test('clipboard button follows API availability and handles success and rejection', async () => {
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, { clipboard: { value: undefined } }),
  );
  const view = setup();
  expect(
    screen.queryByRole('button', { name: 'Paste from clipboard' }),
  ).toBeNull();
  view.unmount();
  const readText = vi
    .fn()
    .mockResolvedValueOnce('Clipboard Name')
    .mockRejectedValueOnce(new Error('Blocked'));
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, { clipboard: { value: { readText } } }),
  );
  const { session } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
  await waitFor(() =>
    expect(session.getState().build?.entrants[0]?.name).toBe('Clipboard Name'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Clipboard access was blocked. Press Ctrl+V in the box.',
  );
});

test('building and error states describe pending and failed list processing', async () => {
  let rejectJob: (error: Error) => void = () => undefined;
  const runner: BuildRunner = {
    build: () =>
      new Promise<BuildResult>((_, reject) => {
        rejectJob = reject;
      }),
    cancel: () => undefined,
    dispose: () => undefined,
  };
  setup(runner);
  paste('A');
  expect(summary().getByText('Building list…')).toBeTruthy();
  await act(async () => rejectJob(new Error('Unable to process list')));
  expect(summary().getByText('Unable to process list')).toBeTruthy();
});
