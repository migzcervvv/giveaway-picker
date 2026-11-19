// @vitest-environment node
import { expect, test } from 'vitest';
import { read, utils, version } from 'xlsx';
import { toExportJson, toExportRows } from '@/engine';
import { createRecordExport, recordCsv } from './record';
import { savedRecord } from './test-utils';

test('JSON is the exact schema-1 engine snapshot and does not include the roster', async () => {
  const record = await savedRecord({ actions: true });
  const blob = await createRecordExport(record, 'json');
  expect(blob.type).toBe('application/json;charset=utf-8');
  expect(await blob.text()).toBe(toExportJson(record));
  const parsed = JSON.parse(await blob.text());
  expect(parsed.schema).toBe(1);
  expect(parsed.events).toEqual(record.events);
  expect(parsed.listHash).toBe(record.listHash);
  expect(parsed.counts.entrantCount).toBe(5);
  expect(await blob.text()).not.toContain('Unselected');
});

// Independent state machine: exercise quoted CR/LF instead of splitting records on newlines.
function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (index === 0 && char === '\uFEFF') continue;
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\r')) {
      row.push(cell);
      cell = '';
      if (char === '\r') {
        expect(csv[++index]).toBe('\n');
        rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  expect(quoted).toBe(false);
  return rows;
}

test('CSV is one rectangular RFC-4180 document with stable section/union columns and all events', async () => {
  const record = await savedRecord({
    names: [
      '=1+1',
      '"José, 雪"\r\nNext',
      '\tformula',
      '@SUM(A1)',
      'Unselected',
    ],
    actions: true,
  });
  const csv = recordCsv(record);
  expect(csv).toBe(recordCsv(record));
  const [headers = [], ...rows] = parseCsv(csv);
  expect(headers[0]).toBe('section');
  expect(new Set(headers).size).toBe(headers.length);
  const sections = toExportRows(record);
  const expected = [
    ...sections.summary.map((row) => ({ section: 'summary', ...row })),
    ...sections.slots.map((row) => ({ section: 'slot', ...row })),
    ...sections.events.map((row) => ({ section: 'event', ...row })),
  ];
  expect(rows).toHaveLength(expected.length);
  for (const [index, row] of rows.entries()) {
    expect(row).toHaveLength(headers.length);
    for (const [column, value] of Object.entries(expected[index] ?? {})) {
      expect(row[headers.indexOf(column)]).toBe(value);
    }
  }
  expect(rows.filter((row) => row[0] === 'event')).toHaveLength(
    record.events.length,
  );
  const blob = await createRecordExport(record, 'csv');
  expect(blob.type).toBe('text/csv;charset=utf-8');
  expect(await blob.text()).toBe(csv.slice(1)); // UTF-8 decoder consumes the BOM.
});

test.each(['=', '+', '-', '@', '\t', '\r'])(
  'XLSX round-trip keeps %j values inert, all sheets, counts and event logs',
  async (trigger) => {
    expect(version).toBe('0.20.3');
    const record = await savedRecord({
      names: [
        trigger + 'SUM(A1)',
        '"Name, Snow雪"\r\nLine',
        'Backup 1',
        'Backup 2',
        'Unselected',
      ],
      actions: true,
    });
    const blob = await createRecordExport(record, 'xlsx');
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const workbook = read(await blob.arrayBuffer(), { type: 'array' });
    expect(workbook.SheetNames).toEqual(['Summary', 'Slots', 'Events']);
    const rows = toExportRows(record);
    for (const [name, expected] of [
      ['Summary', rows.summary],
      ['Slots', rows.slots],
      ['Events', rows.events],
    ] as const) {
      const sheet = workbook.Sheets[name];
      expect(sheet).toBeDefined();
      if (!sheet) throw new Error('Missing sheet');
      // SheetJS's XLSX reader normalizes embedded CRLF to LF; CSV preserves exact CRLF.
      const decoded = expected.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value.replace(/\r\n/g, '\n'),
          ]),
        ),
      );
      expect(utils.sheet_to_json(sheet, { defval: '' })).toEqual(decoded);
      for (const [address, cell] of Object.entries(sheet)) {
        if (!address.startsWith('!')) {
          expect(cell.f).toBeUndefined();
          expect(cell.t).toBe('s');
          expect(typeof cell.v).toBe('string');
        }
      }
    }
  },
);

test.each(['=', '+', '-', '@', '\t', '\r'])(
  'CSV retains the engine formula protection for %j',
  async (trigger) => {
    const record = await savedRecord({
      names: [trigger + 'SUM(A1)', 'Bob', 'Carol', 'Dana'],
    });
    const [headers = [], ...rows] = parseCsv(recordCsv(record));
    const slot = rows.find((row) => row[0] === 'slot');
    expect(slot?.[headers.indexOf('name')]).toBe("'" + trigger + 'SUM(A1)');
  },
);
