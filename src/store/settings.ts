import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

type Settings = {
  soundEnabled: boolean;
  revealMode: 'drum' | 'reel' | 'wheel';
  theme: 'dark' | 'light';
  dedupe: boolean;
  foldDiacritics: boolean;
  removeCalled: boolean;
  oneAtATime: boolean;
};

const defaults: Settings = {
  soundEnabled: true,
  revealMode: 'drum',
  theme: 'dark',
  dedupe: true,
  foldDiacritics: false,
  removeCalled: true,
  oneAtATime: false,
};

function preferences(settings: Partial<Settings> = {}): Settings {
  const {
    soundEnabled,
    revealMode,
    theme,
    dedupe,
    foldDiacritics,
    removeCalled,
    oneAtATime,
  } = settings;
  return {
    soundEnabled:
      typeof soundEnabled === 'boolean' ? soundEnabled : defaults.soundEnabled,
    revealMode:
      revealMode === 'reel' || revealMode === 'wheel' ? revealMode : 'drum',
    theme: theme === 'light' ? theme : 'dark',
    dedupe: typeof dedupe === 'boolean' ? dedupe : defaults.dedupe,
    foldDiacritics:
      typeof foldDiacritics === 'boolean'
        ? foldDiacritics
        : defaults.foldDiacritics,
    removeCalled:
      typeof removeCalled === 'boolean' ? removeCalled : defaults.removeCalled,
    oneAtATime:
      typeof oneAtATime === 'boolean' ? oneAtATime : defaults.oneAtATime,
  };
}

export function createSettingsStore(storage?: StateStorage) {
  return createStore(
    persist(
      (
        set,
        get: () => Settings & {
          update: (patch: Partial<Settings>) => void;
          reset: () => void;
        },
      ) => ({
        ...defaults,
        update: (patch: Partial<Settings>) =>
          set(preferences({ ...get(), ...patch })),
        reset: () => set(defaults),
      }),
      {
        name: 'giveaway-picker-settings',
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: preferences,
        merge: (saved, current) => ({
          ...current,
          ...preferences((saved ?? {}) as Partial<Settings>),
        }),
      },
    ),
  );
}

export const settingsStore = createSettingsStore();
