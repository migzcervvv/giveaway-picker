import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '@/ui/App';

afterEach(cleanup);

test('renders the app title as a level-one heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Giveaway Picker' }),
  ).toBeTruthy();
});
