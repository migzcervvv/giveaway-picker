// @vitest-environment node
import { expect, test } from 'vitest';
import { buildEntrants, hashEntrants } from './index';

const opts = { dedupe: false, foldDiacritics: false };
const entrants = (...names: string[]) => buildEntrants(names, opts).entrants;

test('matches the independently computed SHA-256 digest', async () => {
  // .NET SHA256.HashData over the UTF-8 bytes of "1\nalice\nbob", with no trailing newline.
  await expect(hashEntrants(entrants('alice', 'bob'))).resolves.toBe(
    '321e6b9de7570f2df4f88c55eab677334bc7a4025dc08f014482f62a8bf776e3',
  );
});

test('is order and display-case independent and leaves the input untouched', async () => {
  const input = Object.freeze(
    entrants('Zoë', 'ALICE', 'Bob').map((item) => Object.freeze(item)),
  );
  const expected = await hashEntrants(input);
  await expect(hashEntrants(entrants('bob', 'alice', 'ZOË'))).resolves.toBe(
    expected,
  );
  expect(input.map(({ name }) => name)).toEqual(['Zoë', 'ALICE', 'Bob']);
});

test('preserves the multiplicity of equal keys', async () => {
  const single = await hashEntrants(entrants('alice'));
  await expect(hashEntrants(entrants('alice', 'ALICE'))).resolves.not.toBe(
    single,
  );
});
