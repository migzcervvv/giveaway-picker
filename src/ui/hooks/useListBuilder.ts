import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { splitPaste } from '@/engine';
import { BuildSupersededError, createBuildRunner } from '@/io/build/runner';
import type { BuildRunner } from '@/io/build/runner';
import { hasUnresolvedDraw, sessionStore } from '@/store/session';
import { settingsStore } from '@/store/settings';

export type ListBuilder = {
  text: string;
  status: 'idle' | 'building' | 'ready' | 'error';
  error: string | null;
  locked: boolean;
  isActive(): boolean;
  setText(
    text: string,
    options?: { immediate?: boolean; imported?: boolean },
  ): void;
  clear(): void;
};

export function useListBuilder({
  runner: suppliedRunner,
  session = sessionStore,
  settings = settingsStore,
  debounceMs = 250,
}: {
  runner?: BuildRunner;
  session?: typeof sessionStore;
  settings?: typeof settingsStore;
  debounceMs?: number;
} = {}): ListBuilder {
  const [text, setLocalText] = useState(() => session.getState().rawText);
  const [status, setStatus] = useState<ListBuilder['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [initialRunner] = useState(() => suppliedRunner ?? createBuildRunner());
  const control = useRef({
    text,
    job: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    runner: initialRunner,
    mounted: false,
  });
  const locked = useStore(session, (state) => hasUnresolvedDraw(state.draws));

  useEffect(() => {
    const current = control.current;
    current.mounted = true;
    // React StrictMode replays effects. Recreate an owned runner after cleanup.
    current.runner = suppliedRunner ?? createBuildRunner();
    const state = session.getState();
    const { dedupe, foldDiacritics } = settings.getState();
    if (
      state.rawText.trim() &&
      !hasUnresolvedDraw(state.draws) &&
      (!state.build ||
        state.buildOptions.dedupe !== dedupe ||
        state.buildOptions.foldDiacritics !== foldDiacritics)
    )
      void build(state.rawText);
    const unsubscribe = settings.subscribe((next, previous) => {
      if (
        (next.dedupe !== previous.dedupe ||
          next.foldDiacritics !== previous.foldDiacritics) &&
        current.text.trim() &&
        !hasUnresolvedDraw(session.getState().draws)
      ) {
        build(current.text);
      }
    });
    return () => {
      current.mounted = false;
      unsubscribe();
      clearTimeout(current.timer);
      current.job++;
      current.runner.cancel();
      if (!suppliedRunner) current.runner.dispose();
    };
    // The injected stores and runner define the lifetime of this subscription.
  }, [session, settings, suppliedRunner]);

  function report(cause: unknown) {
    setStatus('error');
    setError(
      cause instanceof Error ? cause.message : 'Unable to build the list',
    );
  }

  async function build(value: string) {
    const current = control.current;
    const job = ++current.job;
    const generation = session.getState().generation;
    setStatus('building');
    setError(null);
    try {
      const { dedupe, foldDiacritics } = settings.getState();
      const result = await current.runner.build(
        session.getState().imported ? value.split('\n') : splitPaste(value),
        {
          dedupe,
          foldDiacritics,
        },
      );
      if (job !== current.job) return;
      if (generation !== session.getState().generation) return;
      if (value !== session.getState().rawText) return;
      session
        .getState()
        .setBuild(result, generation, { dedupe, foldDiacritics });
      setStatus('ready');
    } catch (cause) {
      if (job === current.job && !(cause instanceof BuildSupersededError))
        report(cause);
    }
  }

  function commit(value: string) {
    if (hasUnresolvedDraw(session.getState().draws)) return;
    try {
      if (!value.trim()) {
        control.current.runner.cancel();
        // setInput is a no-op for unchanged text, so explicitly detach an empty build.
        if (session.getState().build) session.getState().reset();
        setStatus('idle');
        setError(null);
      } else {
        void build(value);
      }
    } catch (cause) {
      report(cause);
    }
  }

  function setText(
    value: string,
    options?: { immediate?: boolean; imported?: boolean },
  ) {
    if (!control.current.mounted || hasUnresolvedDraw(session.getState().draws))
      return;
    const current = control.current;
    current.job++;
    current.runner.cancel();
    clearTimeout(current.timer);
    current.text = value;
    setLocalText(value);
    try {
      session.getState().setInput(value, options?.imported);
    } catch (cause) {
      report(cause);
      return;
    }
    if (value.trim()) setStatus('building');
    if (options?.immediate) commit(value);
    else current.timer = setTimeout(() => commit(value), debounceMs);
  }

  return {
    text,
    status,
    error,
    locked,
    isActive: () => control.current.mounted,
    setText,
    clear: () => setText('', { immediate: true }),
  };
}
