import { expect, test } from 'vitest';
import { NORMALIZATION_VERSION, normalizeName } from './index';

test('uses normalization version 1', () => {
  expect(NORMALIZATION_VERSION).toBe(1);
});

test('trims and collapses whitespace and removes zero-width spaces', () => {
  expect(normalizeName('\t  JOHN\u00A0\n\tSmi\u200Bth  ')).toEqual({
    display: 'JOHN Smith',
    key: 'john smith',
  });
});

test.each(['', ' \t\r\n\u00A0\u200B '])(
  'returns null for blank input %j',
  (raw) => {
    expect(normalizeName(raw)).toBeNull();
  },
);

test('uses NFC for display and NFKC with lowercase for the key', () => {
  expect(normalizeName('Jose\u0301 Ｓｍｉｔｈ')).toEqual({
    display: 'José Ｓｍｉｔｈ',
    key: 'josé smith',
  });
});

test('collapses spaces introduced by compatibility normalization', () => {
  expect(normalizeName('A \u00A8 B')?.key).toBe('a \u0308 b');
  expect(normalizeName('A \u00A8 B', { foldDiacritics: true })?.key).toBe('a b');
});

test('only strips diacritics from the key when requested', () => {
  expect(normalizeName('José', { foldDiacritics: false })).toEqual({
    display: 'José',
    key: 'josé',
  });
  expect(normalizeName('José', { foldDiacritics: true })).toEqual({
    display: 'José',
    key: 'jose',
  });
});
