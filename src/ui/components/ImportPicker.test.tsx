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
import { App } from '@/ui/App';
import { historyFixture } from '@/ui/screens/history-test-utils';
import { createImportRunner } from '@/io/import/runner';
import type { ImportRunner } from '@/io/import/protocol';

vi.mock('@/io/import/runner');
let fixture: ReturnType<typeof historyFixture>;
let finish: (cells: string[]) => void;
beforeEach(() => {
  fixture = historyFixture();
  const runner: ImportRunner = {
    open: async () => ({
      sheets: [{ name: 'Guests', rowCount: 6, columnCount: 2 }],
    }),
    preview: async (sheet, hasHeader) => ({
      sheet,
      hasHeader,
      columns: [
        { index: 0, letter: 'A', header: '' },
        { index: 1, letter: 'B', header: hasHeader ? 'Name' : '' },
      ],
      firstRows: [['1', 'Doe, Jane']],
    }),
    extract: vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    ),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  vi.mocked(createImportRunner).mockReturnValue(runner);
  render(<App flow={fixture.flow} />);
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  await fixture.db.delete();
});
const button = (name: string) => screen.getByRole('button', { name });
const session = () => fixture.flow.getState().session.getState();
function choose() {
  fireEvent.change(screen.getByLabelText('CSV or XLSX file'), {
    target: { files: [new File([''], 'guests.csv')] },
  });
}
async function select() {
  choose();
  fireEvent.change(await screen.findByLabelText('Name column'), {
    target: { value: '1' },
  });
  fireEvent.click(screen.getByLabelText('First row contains headers'));
  await screen.findByRole('option', { name: 'B — Name' });
}
async function complete(cells: string[]) {
  await act(async () => finish(cells));
}

test('preview and cancel preserve the pool; applying selected cells builds and draws', async () => {
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Original' },
  });
  await waitFor(() => expect(session().build?.stats.finalCount).toBe(1));
  const original = session();
  await select();
  expect(session()).toBe(original);
  fireEvent.click(button('Cancel import'));
  expect(session()).toBe(original);
  await select();
  fireEvent.click(button('Use selected column'));
  expect(
    vi.mocked(createImportRunner).mock.results.at(-1)?.value.extract,
  ).toHaveBeenCalledWith('Guests', 1, true);
  await complete(['Doe, Jane', 'A;B', 'X\tY', 'Two\nLines', '', 'Doe, Jane']);
  expect(session().build?.stats).toEqual({
    rawCount: 6,
    blankDropped: 1,
    duplicatesRemoved: 1,
    finalCount: 4,
  });
  expect(session().build?.entrants.map((e) => e.name)).toEqual([
    'Doe, Jane',
    'A;B',
    'X Y',
    'Two Lines',
  ]);
  fireEvent.click(button('Draw'));
  await screen.findByRole('heading', { name: 'Draw results' });
  fireEvent.click(button('Input'));
  expect(
    (screen.getByLabelText('CSV or XLSX file') as HTMLInputElement).matches(
      ':disabled',
    ),
  ).toBe(true);
});
test('single cell keeps its comma across navigation and settings rebuilds', async () => {
  await select();
  fireEvent.click(button('Use selected column'));
  await complete(['Doe, Jane']);
  fireEvent.click(button('History'));
  fireEvent.click(button('Return to raffle'));
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
    'Doe, Jane',
  );
  fireEvent.click(
    screen.getByRole('switch', { name: 'Remove duplicate names' }),
  );
  await waitFor(() => expect(session().buildOptions.dedupe).toBe(false));
  expect(session().build?.entrants.map((e) => e.name)).toEqual(['Doe, Jane']);
});
test.each(['cancel', 'new file', 'unmount', 'edit'])(
  'late extraction after %s cannot apply',
  async (action) => {
    await select();
    fireEvent.click(button('Use selected column'));
    if (action === 'cancel') fireEvent.click(button('Cancel import'));
    if (action === 'new file') choose();
    if (action === 'unmount') fireEvent.click(button('History'));
    if (action === 'edit')
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New draft' },
      });
    await complete(['Stale']);
    expect(session().rawText).toBe(action === 'edit' ? 'New draft' : '');
  },
);
test('column with only unusable names leaves the draft untouched', async () => {
  await select();
  const original = session();
  fireEvent.click(button('Use selected column'));
  await complete([' ', '\u200B']);
  expect(screen.getByRole('alert').textContent).toContain('no usable names');
  expect(session()).toBe(original);
});

test('Draw waits for the imported generation to finish building', async () => {
  let finishBuild: (() => void) | undefined;
  class BuildWorker {
    onmessage?: (event: { data: BuildResponse }) => void;
    terminate() {}
    postMessage(request: BuildRequest) {
      finishBuild = () =>
        this.onmessage?.({
          data: {
            id: request.id,
            ok: true,
            result: buildEntrants(request.names, request),
          },
        });
    }
  }
  vi.stubGlobal('Worker', BuildWorker);
  await select();
  fireEvent.click(button('Use selected column'));
  await complete(Array.from({ length: 5001 }, (_, i) => 'Guest ' + i));
  expect(screen.getByText('Building list…')).toBeTruthy();
  expect((button('Draw') as HTMLButtonElement).disabled).toBe(true);
  expect(finishBuild).toBeTypeOf('function');
  await act(async () => finishBuild?.());
  expect((button('Draw') as HTMLButtonElement).disabled).toBe(false);
});
