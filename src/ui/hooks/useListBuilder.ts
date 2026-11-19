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
  setText(text: string, options?: { immediate?: boolean }): void;
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
  });
  const locked = useStore(session, (state) => hasUnresolvedDraw(state.draws));

  useEffect(() => {
    const current = control.current;
    // React StrictMode replays effects. Recreate an owned runner after cleanup.
    current.runner = suppliedRunner ?? createBuildRunner();
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
      const result = await current.runner.build(splitPaste(value), {
        dedupe,
        foldDiacritics,
      });
      if (job !== current.job) return;
      if (generation !== session.getState().generation) return;
      if (value !== session.getState().rawText) return;
      session.getState().setBuild(result, generation);
      setStatus('ready');
    } catch (cause) {
      if (job === current.job && !(cause instanceof BuildSupersededError))
        report(cause);
    }
  }

  function commit(value: string) {
    if (hasUnresolvedDraw(session.getState().draws)) return;
    try {
      session.getState().setInput(value);
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

  function setText(value: string, options?: { immediate?: boolean }) {
    if (hasUnresolvedDraw(session.getState().draws)) return;
    const current = control.current;
    current.job++;
    current.runner.cancel();
    clearTimeout(current.timer);
    current.text = value;
    setLocalText(value);
    if (options?.immediate) commit(value);
    else current.timer = setTimeout(() => commit(value), debounceMs);
  }

  return {
    text,
    status,
    error,
    locked,
    setText,
    clear: () => setText('', { immediate: true }),
  };
}
