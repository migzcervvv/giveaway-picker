import { read, utils, type WorkBook, type WorkSheet } from 'xlsx';
import type { Command, Result, SheetInfo } from './protocol';

// Parse CSV as literal UTF-8 text. Spreadsheet format guessing loses leading zeros
// and treats some literal values as dates, formulas or markup.
function csvWorkbook(bytes: ArrayBuffer): WorkBook {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!source.length) throw new Error('Empty CSV file.');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  function endField() { row.push(field); field = ''; closed = false; }
  for (let i = 0; i < source.length; i++) {
    const c = source.charAt(i);
    if (quoted) {
      if (c !== '"') field += c;
      else if (source[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (c === ',') endField();
    else if (c === '\r' || c === '\n') {
      endField(); rows.push(row); row = [];
      if (c === '\r' && source[i + 1] === '\n') i++;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Invalid CSV quoting.');
    else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quotation.');
  if (row.length || field || closed) { endField(); rows.push(row); }
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'Sheet1');
  return book;
}

function open(filename: string, bytes: ArrayBuffer) {
  if (/\.csv$/i.test(filename)) return csvWorkbook(bytes);
  const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 4));
  if (!/\.xlsx$/i.test(filename) || signature.join(',') !== '80,75,3,4')
    throw new Error('Choose a valid CSV or XLSX file.');
  try {
    return read(bytes, { type: 'array', cellFormula: false, cellHTML: false });
  } catch { throw new Error('Invalid XLSX workbook.'); }
}

function dimensions(name: string, sheet: WorkSheet): SheetInfo {
  const end = sheet['!ref'] && utils.decode_range(sheet['!ref']).e;
  if (end && (end.r >= 1048576 || end.c >= 16384)) throw new Error('Worksheet exceeds supported dimensions.');
  return { name, rowCount: end ? end.r + 1 : 0, columnCount: end ? end.c + 1 : 0 };
}

export function createParser() {
  let book: WorkBook | undefined;
  return (command: Command): Result => {
    if (command.kind === 'open') {
      book = undefined;
      const loaded = open(command.filename, command.bytes);
      book = loaded;
      return { sheets: loaded.SheetNames.map(name => {
        const sheet = loaded.Sheets[name];
        if (!sheet) throw new Error('Missing worksheet.');
        return dimensions(name, sheet);
      }) };
    }
    const name = command.sheet;
    const sheet = book?.SheetNames.includes(name) && book.Sheets[name];
    if (!sheet) throw new Error('Unknown worksheet.');
    const { rowCount, columnCount } = dimensions(name, sheet);
    const start = Number(command.hasHeader);
    function text(row: number, col: number): string {
      const cell = sheet && sheet[utils.encode_cell({ r: row, c: col })];
      if (!cell || cell.v == null) return '';
      const covered = sheet && sheet['!merges']?.some(({ s, e }) =>
        row >= s.r && row <= e.r && col >= s.c && col <= e.c && (row !== s.r || col !== s.c));
      return covered ? '' : utils.format_cell(cell);
    }
    if (command.kind === 'extract') {
      const col = command.columnIndex;
      if (!Number.isInteger(col) || col < 0 || col >= columnCount) throw new Error('Invalid column.');
      return Array.from({ length: rowCount - start }, (_, i) => text(i + start, col));
    }
    const columns = Array.from({ length: columnCount }, (_, index) => ({
      index, letter: utils.encode_col(index), header: command.hasHeader ? text(0, index) : '',
    }));
    const firstRows = Array.from({ length: Math.min(5, rowCount - start) },
      (_, i) => columns.map(({ index }) => text(i + start, index)));
    return { sheet: name, columns, firstRows, hasHeader: command.hasHeader };
  };
}
