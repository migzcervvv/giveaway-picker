import { useEffect, useRef, useState } from 'react';

// The sequence controls presentation timing only. It never receives entrant data.
export function useCardReveal() {
  const pending = useRef<(() => void) | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const remaining = useRef(0);
  const deadline = useRef(0);
  const [paused, setPaused] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 650);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  function silence() {
    const context = audio.current;
    audio.current = null;
    if (context && context.state !== 'closed')
      void context.close().catch(() => {});
  }

  function chime() {
    try {
      const context = new AudioContext();
      audio.current = context;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.connect(volume);
      volume.connect(context.destination);
      const now = context.currentTime;
      tone.frequency.setValueAtTime(523.25, now);
      tone.frequency.setValueAtTime(783.99, now + 0.09);
      volume.gain.setValueAtTime(0.035, now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      tone.onended = () => {
        if (audio.current === context) silence();
      };
      tone.start(now);
      tone.stop(now + 0.27);
      void context.resume().catch(() => {
        if (audio.current === context) silence();
      });
    } catch {
      silence();
    }
  }

  function dispose() {
    clearTimeout(timer.current);
    timer.current = undefined;
    cleanup.current?.();
    cleanup.current = null;
    pending.current = null;
    silence();
  }
  useEffect(() => dispose, []);

  function finish(animate: boolean) {
    const disclose = pending.current;
    dispose();
    setPaused(false);
    setShuffling(false);
    setCelebrating(animate && !!disclose);
    disclose?.();
  }

  function schedule() {
    deadline.current = performance.now() + remaining.current;
    timer.current = window.setTimeout(() => finish(true), remaining.current);
  }

  function togglePause() {
    if (!pending.current) return;
    if (timer.current === undefined) {
      schedule();
      setPaused(false);
    } else {
      remaining.current = Math.max(0, deadline.current - performance.now());
      clearTimeout(timer.current);
      timer.current = undefined;
      silence();
      setPaused(true);
    }
  }

  function start(duration: number, sound: boolean, disclose: () => void) {
    if (pending.current) return;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference || preference.matches) {
      setCelebrating(false);
      disclose();
      return;
    }
    pending.current = disclose;
    setCelebrating(false);
    setShuffling(true);
    if (sound) chime();
    remaining.current = duration;
    schedule();
    const changed = () => {
      if (preference.matches) finish(false);
    };
    preference.addEventListener('change', changed);
    cleanup.current = () => {
      preference.removeEventListener('change', changed);
    };
  }

  return {
    start,
    paused,
    togglePause,
    shuffling,
    celebrating,
    silence,
    skip: () => finish(false),
    cancel: () => {
      dispose();
      setPaused(false);
      setShuffling(false);
      setCelebrating(false);
    },
    settle: () => setCelebrating(false),
  };
}
