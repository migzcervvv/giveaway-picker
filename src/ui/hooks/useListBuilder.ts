import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { splitPaste } from '@/engine';
import { BuildSupersededError, createBuildRunner } from '@/io/build/runner';
import type { BuildRunner } from '@/io/build/runner';
import { hasUnresolvedDraw, sessionStore } from '@/store/session';
import { settingsStore } from '@/store/settings';

import { shuffleRoster } from '@/io/build/shuffle';

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
  shuffle(): void;
  shuffled: boolean;
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
  const worker = useRef<Worker | null>(null);
  const [shuffled, setShuffled] = useState(false);
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
      worker.current?.terminate();
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
    worker.current?.terminate();
    worker.current = null;
    setShuffled(false);
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
    shuffled,
    shuffle() {
      const current = control.current,
        state = session.getState();
      if (
        !current.mounted ||
        !state.build ||
        status === 'building' ||
        worker.current ||
        hasUnresolvedDraw(state.draws)
      )
        return;
      const request = {
        text: state.rawText,
        imported: state.imported,
        options: state.buildOptions,
        previous: state.build,
      };
      const job = ++current.job;
      setShuffled(false);
      setStatus('building');
      setError(null);
      const apply = (result: ReturnType<typeof shuffleRoster>) => {
        if (
          job !== current.job ||
          !current.mounted ||
          state !== session.getState()
        )
          return;
        session.setState({ rawText: result.text, build: result.build });
        current.text = result.text;
        setLocalText(result.text);
        setStatus('ready');
        setShuffled(true);
      };
      try {
        if (request.previous.stats.rawCount <= 5000) {
          apply(shuffleRoster(request));
          return;
        }
        const task = new Worker(
          new URL('../../io/build/shuffle.worker.ts', import.meta.url),
          { type: 'module' },
        );
        worker.current = task;
        task.onmessage = ({ data }) => {
          task.terminate();
          worker.current = null;
          apply(data);
        };
        task.onerror = () => {
          task.terminate();
          worker.current = null;
          if (job === current.job)
            report(new Error('Shuffle failed. Retry the shuffle.'));
        };
        task.postMessage(request);
      } catch (error) {
        worker.current?.terminate();
        worker.current = null;
        report(error);
      }
    },
    clear: () => setText('', { immediate: true }),
  };
}
