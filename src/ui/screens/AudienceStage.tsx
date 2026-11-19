import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { deriveState } from '@/engine';
import type { drawFlowStore } from '@/store/drawFlow';
import { useCardReveal } from '../hooks/useCardReveal';
import { RevealedWinners } from './RevealedWinners';
import { Button } from '../components/Button';

const batchSizes = { Minor: 6, Major: 3, Grand: 1 };
export type Prize = keyof typeof batchSizes;

export function AudienceStage({
  flow,
  prize,
  setPrize,
  shown,
  onReveal,
  onExit,
}: {
  flow: typeof drawFlowStore;
  prize: Prize;
  setPrize(prize: Prize): void;
  shown: number;
  onReveal(id: string, count: number): void;
  onExit(): void;
}) {
  const sequence = useCardReveal();
  const state = useStore(flow);
  const sound = useStore(state.settings, (s) => s.soundEnabled);
  const record = useStore(state.session, (s) =>
    s.draws.find((d) => d.id === state.activeId),
  );
  const oneAtATime = useStore(state.settings, (s) => s.oneAtATime);
  const [managing, setManaging] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [managing]);
  const [flipFrom, setFlipFrom] = useState(0);
  const [page, setPage] = useState(0);
  const slots = record
    ? deriveState(record.events).slots.filter(
        (s) => s.role === 'winner' || s.status !== 'standby',
      )
    : [];
  const visible = record
    ? (state.visible[record.id] ?? record.slots.length)
    : 0;
  const size =
    oneAtATime || (record && visible < record.config.winners)
      ? 1
      : batchSizes[prize];
  const disclosed = Math.min(shown, slots.length);
  const lastPage = Math.max(0, Math.ceil(disclosed / size) - 1);
  const currentPage = Math.min(page, lastPage);
  const more = disclosed < slots.length;
  const cards = slots.slice(
    currentPage * size,
    Math.min(disclosed, (currentPage + 1) * size),
  );

  const count = Math.min(
    (Math.floor(disclosed / size) + 1) * size,
    slots.length,
  );
  function reveal() {
    if (!record || state.busy || !more) return;
    setFlipFrom(disclosed);
    sequence.start(
      { Minor: 2000, Major: 2450, Grand: 2850 }[prize],
      sound,
      () => {
        const nextSlot = slots[count - 1];
        if (nextSlot?.role === 'winner' && nextSlot.rank > visible)
          state.next(record.id);
        onReveal(record.id, count);
        setPage(Math.floor((count - 1) / size));
      },
    );
  }

  if (managing)
    return (
      <RevealedWinners
        flow={flow}
        record={record}
        slots={slots.slice(0, disclosed)}
        heading={heading}
        onResume={() => setManaging(false)}
      />
    );
  return (
    <main className="audience-stage" aria-label="Audience View">
      <header className="stage-bar">
        <span className="font-display text-3xl">The Lucky Draw</span>
        <div className="stage-tools">
          <Button
            aria-pressed={!sound}
            onClick={() => {
              sequence.silence();
              state.settings.getState().update({ soundEnabled: !sound });
            }}
          >
            Mute
          </Button>
          <Button
            disabled={state.busy}
            onClick={() => {
              sequence.cancel();
              if (more) setManaging(true);
              else onExit();
            }}
          >
            Return to operator
          </Button>
        </div>
      </header>
      <section className="stage-content">
        {record ? (
          <p className="stage-prize">{prize} prize</p>
        ) : (
          <label className="stage-prize">
            Prize category{' '}
            <select
              disabled={state.busy}
              value={prize}
              onChange={(e) => setPrize(e.target.value as Prize)}
            >
              {Object.keys(batchSizes).map((tier) => (
                <option key={tier}>{tier}</option>
              ))}
            </select>
          </label>
        )}
        <h1 className="stage-title" tabIndex={-1} ref={heading}>
          {state.busy
            ? 'Preparing draw…'
            : sequence.shuffling
              ? 'Shuffling…'
              : disclosed
                ? 'Winners'
                : record
                  ? 'Ready to reveal'
                  : 'Ready to draw'}
        </h1>
        {state.error && (
          <p role="alert">
            The draw could not be presented. Return to the operator to check its
            status.
          </p>
        )}
        <div aria-live="polite" aria-atomic="true">
          {sequence.shuffling && (
            <div className="stage-cards mystery-cards" aria-hidden="true">
              {Array.from({ length: count - disclosed }, (_, i) => (
                <div key={i} className="mystery-ticket">
                  <span>✦</span>
                </div>
              ))}
            </div>
          )}
          {!sequence.shuffling && cards.length > 0 && (
            <ol
              className="stage-cards"
              data-celebrate={sequence.celebrating || undefined}
            >
              {cards.map((slot, index) => (
                <li
                  key={slot.rank}
                  data-flip={
                    currentPage * size + index >= flipFrom || undefined
                  }
                >
                  <p className="stage-prize">
                    {slot.role === 'backup'
                      ? 'Promoted backup'
                      : 'Winner ' + slot.rank}
                  </p>
                  <p
                    dir="auto"
                    className="stage-name"
                    data-long={slot.name.length > 60 || undefined}
                  >
                    {slot.name}
                  </p>
                  <p>
                    {slot.status === 'pending'
                      ? 'Awaiting call'
                      : slot.status.replace('_', '-')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="stage-actions">
          {!record && (
            <Button
              disabled={state.busy}
              className="primary-action"
              onClick={() => void state.start(true)}
            >
              Start draw
            </Button>
          )}
          {more && (
            <Button
              className="primary-action"
              onClick={(event) => {
                if (event.detail <= 1) {
                  if (sequence.shuffling) sequence.skip();
                  else reveal();
                }
              }}
            >
              {sequence.shuffling
                ? 'Skip'
                : disclosed
                  ? 'Reveal next batch'
                  : 'Reveal'}
            </Button>
          )}
          {!sequence.shuffling && lastPage > 0 && (
            <>
              <Button
                disabled={currentPage === 0}
                onClick={() => {
                  sequence.settle();
                  setPage(currentPage - 1);
                }}
              >
                Previous page
              </Button>
              <span>
                Page {currentPage + 1} of {lastPage + 1}
              </span>
              <Button
                disabled={currentPage >= lastPage}
                onClick={() => {
                  sequence.settle();
                  setPage(currentPage + 1);
                }}
              >
                Next page
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
