import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '@/ui/App';

afterEach(cleanup);

test('renders the app title as a level-one heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'The Lucky Draw' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('navigation', { name: 'Operator navigation' }),
  ).toBeTruthy();
  expect(
    screen
      .getAllByRole('region')
      .map((region) => region.querySelector('h2')?.textContent),
  ).toEqual(['1Entrant list', 'List summary', '2Draw settings']);
  expect(
    (screen.getByRole('button', { name: 'Draw' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
