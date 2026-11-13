export const NORMALIZATION_VERSION = 1;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function normalizeName(
  raw: string,
  opts?: { foldDiacritics?: boolean },
): { display: string; key: string } | null {
  const display = collapseWhitespace(raw.replace(/\u200B/gu, '')).normalize(
    'NFC',
  );

  if (display === '') {
    return null;
  }

  let key = display.normalize('NFKC').toLowerCase();
  if (opts?.foldDiacritics) {
    key = key.normalize('NFD').replace(/\p{M}/gu, '');
  }

  return { display, key: collapseWhitespace(key) };
}
