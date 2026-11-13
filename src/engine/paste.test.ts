import { expect, test } from 'vitest';
import { looksTabular, splitPaste } from './index';

test('splits a single line on commas, semicolons, and tabs', () => {
  expect(splitPaste('a, b; c\td')).toEqual(['a', ' b', ' c', 'd']);
});

test('preserves punctuation and tabs on multi-line pastes', () => {
  expect(splitPaste('Smith, John\nDoe, Jane')).toEqual([
    'Smith, John',
    'Doe, Jane',
  ]);
  expect(splitPaste('a\tb\r\nc;d\re\u2028f\u2029g')).toEqual([
    'a\tb',
    'c;d',
    'e',
    'f',
    'g',
  ]);
});

test('preserves raw blank fields for entrant stats', () => {
  expect(splitPaste('')).toEqual(['']);
  expect(splitPaste('a,,b,')).toEqual(['a', '', 'b', '']);
  expect(splitPaste('a\r\n\r\nb\r\n')).toEqual(['a', '', 'b', '']);
});

test.each([
  ['a\tb\r\nc\td\r\ne\r\n\t\u00A0\r\n\u200B', true],
  ['a\tb\nc', false],
  ['a\tb\nc\nd', false],
  ['a\tb', true],
  ['a', false],
  ['', false],
  ['\t\r\n\u200B', false],
])('uses a strict majority of nonblank lines for %j', (text, expected) => {
  expect(looksTabular(text)).toBe(expected);
});
