import { expect, test } from 'vitest';
import { createSettingsStore } from './settings';

test('persists and reloads only validated preferences, with reset', () => {
  const key = 'giveaway-picker-settings';
  const settings = createSettingsStore(localStorage);
  const defaults = settings.getState();
  const chosen = {
    soundEnabled: false,
    revealMode: 'wheel',
    theme: 'light',
    dedupe: false,
    foldDiacritics: true,
    removeCalled: false,
    oneAtATime: true,
  } as const;
  const injected = {
    ...chosen,
    rawText: 'private',
    entrants: ['private'],
    records: ['private'],
  };
  try {
    settings.getState().update(injected);
    const saved = localStorage.getItem(key);
    expect(JSON.parse(saved ?? '{}').state).toEqual(chosen);
    expect(saved).not.toContain('private');
    localStorage.setItem(key, JSON.stringify({ state: injected, version: 0 }));
    const reload = createSettingsStore(localStorage);
    expect(reload.getState()).toMatchObject(chosen);
    expect(reload.getState()).not.toHaveProperty('rawText');
    reload.getState().reset();
    expect(reload.getState()).toMatchObject({
      ...defaults,
      update: expect.any(Function),
      reset: expect.any(Function),
    });
    expect(localStorage.getItem(key)).not.toContain('private');
  } finally {
    localStorage.removeItem(key);
  }
});
