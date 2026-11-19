// @vitest-environment node
import { expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { createParser } from './parser';

const csv = (text: string) => ({
  kind: 'open' as const, filename: 'names.csv', bytes: new TextEncoder().encode(text).buffer,
});
it('preserves literal UTF-8 CSV values, positions and header interpretation', () => {
  const parse = createParser();
  expect(parse(csv('\uFEFFname,id\r\n"雪, a",0002\r\n\r\n"a""b",=1+1\r\n"a\r\nb",4\r\n5,6\r\n7,8')))
    .toEqual({ sheets: [{ name: 'Sheet1', rowCount: 7, columnCount: 2 }] });
  expect(parse({ kind: 'preview', sheet: 'Sheet1', hasHeader: true })).toEqual({
    sheet: 'Sheet1', hasHeader: true, columns: [
      { index: 0, letter: 'A', header: 'name' }, { index: 1, letter: 'B', header: 'id' }],
    firstRows: [['雪, a', '0002'], ['', ''], ['a"b', '=1+1'], ['a\r\nb', '4'], ['5','6']],
  });
  expect(parse({ kind: 'extract', sheet: 'Sheet1', hasHeader: false, columnIndex: 1 }))
    .toEqual(['id', '0002', '', '=1+1', '4', '6', '8']);
});
it.each(['', '"unterminated', 'ab"c', '"quoted"x'])('rejects invalid CSV and invalidates workbook', value => {
  const parse = createParser();
  parse(csv('valid'));
  expect(() => parse(csv(value))).toThrow();
  expect(() => parse({ kind: 'preview', sheet: 'Sheet1', hasHeader: false })).toThrow();
});
it('reads sparse formatted and cached cells without calculating or filling down', () => {
  const book = utils.book_new();
  const sheet = utils.aoa_to_sheet([['雪'], ['hidden merged value'], [12], [1], [42], [], ['last']]);
  sheet['!merges'] = [utils.decode_range('A1:A2')];
  sheet.A3.z = '00000';
  sheet.A4.z = 'yyyy-mm-dd';
  sheet.A5.f = '100+100';
  sheet.A6 = { t: 'n', f: '100+100' };
  utils.book_append_sheet(book, sheet, 'First');
  utils.book_append_sheet(book, utils.aoa_to_sheet(Array.from({ length: 50000 }, (_, i) => [i])), 'Large');
  const parse = createParser();
  expect(parse({ kind: 'open', filename: 'test.XLSX', bytes: write(book, { type: 'array', bookType: 'xlsx' }) }))
    .toEqual({ sheets: [{ name: 'First', rowCount: 7, columnCount: 1 }, { name: 'Large', rowCount: 50000, columnCount: 1 }] });
  expect(parse({ kind: 'extract', sheet: 'First', columnIndex: 0, hasHeader: false }))
    .toEqual(['雪', '', '00012', '1900-01-01', '42', '', 'last']);
  const result = parse({ kind: 'extract', sheet: 'Large', columnIndex: 0, hasHeader: true });
  expect(result).toHaveLength(49999);
  expect(Array.isArray(result) && result.at(-1)).toBe('49999');
  expect(() => parse({ kind: 'extract', sheet: 'Large', columnIndex: 1, hasHeader: true })).toThrow();
  expect(() => parse({ ...csv('broken'), filename: 'broken.xlsx' })).toThrow();
});
