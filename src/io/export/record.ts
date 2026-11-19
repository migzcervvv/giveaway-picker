import { toExportJson, toExportRows } from '@/engine';
import type { DrawRecord } from '@/engine';

export type ExportFormat = 'json' | 'csv' | 'xlsx';
export function recordCsv(record: DrawRecord): string {
  const sections = toExportRows(record);
  const rows = (['summary', 'slots', 'events'] as const).flatMap((key) =>
    sections[key].map((row) => ({
      section: key === 'slots' ? 'slot' : key === 'events' ? 'event' : key,
      ...row,
    })),
  );
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      headers,
      ...rows.map((row) =>
        headers.map((key) => (row as Record<string, string>)[key] ?? ''),
      ),
    ]
      .map((row) => row.map(quote).join(','))
      .join('\r\n') +
    '\r\n'
  );
}

export async function createRecordExport(
  record: DrawRecord,
  format: ExportFormat,
): Promise<Blob> {
  if (format === 'json')
    return new Blob([toExportJson(record)], {
      type: 'application/json;charset=utf-8',
    });
  if (format === 'csv')
    return new Blob([recordCsv(record)], { type: 'text/csv;charset=utf-8' });
  const { utils, write } = await import('xlsx');
  const workbook = utils.book_new();
  const rows = toExportRows(record);
  for (const [name, data] of [
    ['Summary', rows.summary],
    ['Slots', rows.slots],
    ['Events', rows.events],
  ] as const) {
    utils.book_append_sheet(workbook, utils.json_to_sheet(data), name);
  }
  return new Blob(
    [write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer],
    {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  );
}

export async function downloadRecord(
  record: DrawRecord,
  format: ExportFormat,
): Promise<void> {
  const blob = await createRecordExport(record, format);
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement('a');
    link.href = url;
    link.download = `draw-${record.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || 'record'}.${format}`;
    document.body.append(link);
    link.click();
  } finally {
    link?.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
