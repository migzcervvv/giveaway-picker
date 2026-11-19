import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { normalizeName } from '@/engine';
import { createImportRunner } from '@/io/import/runner';
import type { ImportPreview, ImportWorkbook } from '@/io/import/protocol';
import { hasUnresolvedDraw, sessionStore } from '@/store/session';
import { Button } from './Button';

export function ImportPicker({
  session,
  onApply,
}: {
  session: typeof sessionStore;
  onApply(text: string): void;
}) {
  const generation = useStore(session, (state) => state.generation);
  const locked = useStore(session, (state) => hasUnresolvedDraw(state.draws));
  // A changed draft or draw lock closes the old worker and resets the chooser.
  const [epoch, setEpoch] = useState({ generation, locked, key: 0 });
  if (epoch.generation !== generation || epoch.locked !== locked)
    setEpoch({ generation, locked, key: epoch.key + 1 });
  return (
    <Picker key={epoch.key} {...{ session, generation, locked, onApply }} />
  );
}

function Picker({
  session,
  generation,
  locked,
  onApply,
}: {
  session: typeof sessionStore;
  generation: symbol;
  locked: boolean;
  onApply(text: string): void;
}) {
  const [runner] = useState(createImportRunner);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [book, setBook] = useState<ImportWorkbook>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [column, setColumn] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      request.current++;
      runner.cancel();
    },
    [runner],
  );

  function current(id: number) {
    const state = session.getState();
    return (
      request.current === id &&
      state.generation === generation &&
      !hasUnresolvedDraw(state.draws)
    );
  }
  function cancel() {
    request.current++;
    runner.cancel();
    setFile(undefined);
    setBook(undefined);
    setPreview(undefined);
    setBusy('');
    setError('');
    if (input.current) input.current.value = '';
  }
  function fail(id: number, cause: unknown) {
    if (!current(id)) return;
    setBusy('');
    setError(
      cause instanceof Error ? cause.message : 'Unable to read spreadsheet.',
    );
  }
  async function loadPreview(id: number, sheet: string, header: boolean) {
    setBusy('Reading preview…');
    setError('');
    const next = await runner.preview(sheet, header);
    if (!current(id)) return;
    setPreview(next);
    setBusy('');
  }
  async function open(next: File) {
    const id = ++request.current;
    if (!current(id)) return;
    setFile(next);
    setBook(undefined);
    setPreview(undefined);
    setColumn(0);
    setBusy('Reading file…');
    setError('');
    try {
      const workbook = await runner.open(next);
      if (!current(id)) return;
      const first = workbook.sheets[0];
      if (!first) throw new Error('Workbook has no worksheets.');
      setBook(workbook);
      await loadPreview(id, first.name, false);
    } catch (cause) {
      fail(id, cause);
    }
  }
  function changePreview(sheet: string, header: boolean) {
    const id = ++request.current;
    if (!current(id)) return;
    if (sheet !== preview?.sheet) setColumn(0);
    void loadPreview(id, sheet, header).catch((cause) => fail(id, cause));
  }
  async function apply() {
    const id = ++request.current;
    if (!preview || !current(id)) return;
    setBusy('Reading names…');
    setError('');
    try {
      const cells = await runner.extract(
        preview.sheet,
        column,
        preview.hasHeader,
      );
      if (!current(id)) return;
      if (!cells.some((cell) => normalizeName(cell)))
        throw new Error('Selected column contains no usable names.');
      onApply(
        cells
          .map((cell) => cell.replace(/[\r\n\u2028\u2029]+/gu, ' '))
          .join('\n'),
      );
      cancel();
    } catch (cause) {
      fail(id, cause);
    }
  }

  return (
    <fieldset disabled={locked} className="min-w-0 space-y-3">
      <legend>Import a spreadsheet</legend>
      <label className="block text-sm">
        CSV or XLSX file
        <input
          ref={input}
          className="block w-full py-2"
          type="file"
          accept=".csv,.xlsx"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) void open(next);
          }}
        />
      </label>
      {preview && book && (
        <fieldset
          disabled={!!busy}
          className="min-w-0 space-y-2"
          aria-busy={!!busy}
        >
          <label className="block">
            Worksheet{' '}
            <select
              className="max-w-full"
              value={preview.sheet}
              onChange={(event) => changePreview(event.target.value, false)}
            >
              {book.sheets.map((sheet) => (
                <option key={sheet.name}>{sheet.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={preview.hasHeader}
              onChange={(event) =>
                changePreview(preview.sheet, event.target.checked)
              }
            />{' '}
            First row contains headers
          </label>
          <label className="block">
            Name column{' '}
            <select
              className="max-w-full"
              value={column}
              onChange={(event) => {
                setColumn(Number(event.target.value));
                setError('');
              }}
            >
              {preview.columns.map(({ index, letter, header }) => (
                <option key={index} value={index}>
                  {letter}
                  {header && ' — ' + header}
                </option>
              ))}
            </select>
          </label>
          <div className="max-w-full overflow-auto">
            <table className="text-left text-sm">
              <caption>Preview of first five data rows</caption>
              <thead>
                <tr>
                  {preview.columns.map((col) => (
                    <th scope="col" className="px-2" key={col.index}>
                      {col.letter} {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.firstRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="border px-2 whitespace-pre-wrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {session.getState().rawText && (
            <p>Applying this column replaces your current entrant list.</p>
          )}
          <Button
            disabled={!preview.columns.length}
            onClick={() => void apply()}
          >
            Use selected column
          </Button>
        </fieldset>
      )}
      {busy && <p role="status">{busy}</p>}
      {error && <p role="alert">{error}</p>}
      {error && file && <Button onClick={() => void open(file)}>Retry</Button>}
      {file && <Button onClick={cancel}>Cancel import</Button>}
    </fieldset>
  );
}
