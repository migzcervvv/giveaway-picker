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
  pages,
  batch,
  setBatch,
  onReveal,
  onExit,
  onControls,
  standby,
  setStandby,
}: {
  flow: typeof drawFlowStore;
  prize: Prize;
  setPrize(prize: Prize): void;
  pages: number[];
  batch?: number;
  setBatch(value: number): void;
  onReveal(id: string, count: number): void;
  onExit(): void;
  onControls(): void;
  standby: boolean;
  setStandby(value: boolean): void;
}) {
  const sequence = useCardReveal();
  const state = useStore(flow);
  const sound = useStore(state.settings, (s) => s.soundEnabled);
  const record = useStore(state.session, (s) =>
    s.draws.find((d) => d.id === state.activeId),
  );
  const oneAtATime = useStore(state.settings, (s) => s.oneAtATime);
  const [managing, setManaging] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [managing, standby]);
  const [flipFrom, setFlipFrom] = useState(0);
  const [page, setPage] = useState(0);
  const [requestedEnd, setBatchEnd] = useState(0);
  const slots = record
    ? deriveState(record.events).slots.filter(
        (s) => s.role === 'winner' || s.status !== 'standby',
      )
    : [];
  const batchEnd = Math.min(requestedEnd, slots.length);
  const visible = record
    ? (state.visible[record.id] ?? record.slots.length)
    : 0;
  const size =
    oneAtATime || (record && visible < record.config.winners)
      ? 1
      : (batch ?? batchSizes[prize]);
  const disclosed = Math.min(pages.at(-1) ?? 0, slots.length);
  const lastPage = Math.max(0, pages.length - 1);
  const currentPage = Math.min(page, lastPage);
  const start = pages[currentPage - 1] ?? 0;
  const cards = slots.slice(
    start,
    Math.min(disclosed, pages[currentPage] ?? 0),
  );
  const more = disclosed < slots.length;
  const count = Math.min(disclosed + size, slots.length);
  function present(end: number) {
    if (
      !record ||
      flow.getState().activeId !== record.id ||
      !state.session.getState().draws.includes(record)
    )
      return;
    const next = slots[end - 1];
    if (next?.role === 'winner' && next.rank > visible) state.next(record.id);
    onReveal(record.id, end);
    setPage(pages.length);
  }
  function reveal() {
    if (!record || state.busy || !more) return;
    setReplaying(false);
    setFlipFrom(disclosed);
    sequence.start(
      { Minor: 2000, Major: 2450, Grand: 2850 }[prize],
      sound,
      () => {
        setBatchEnd(count);
        present(Math.min(count, disclosed + 6));
      },
    );
  }

  const replayStart = pages[lastPage - 1] ?? 0;
  function replay() {
    if (state.busy || sequence.shuffling || disclosed <= replayStart) return;
    setReplaying(true);
    setFlipFrom(replayStart);
    sequence.start(1200, sound, () => setPage(lastPage));
  }

  function interruptPresentation() {
    sequence.cancel();
    setReplaying(false);
  }

  if (standby)
    return (
      <main className="audience-stage">
        <section className="stage-content">
          <h1 className="stage-title" ref={heading} tabIndex={-1}>
            Standby
          </h1>
          <Button onClick={() => setStandby(false)}>
            Resume Audience View
          </Button>
        </section>
      </main>
    );

  if (managing)
    return (
      <RevealedWinners
        onControls={onControls}
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
            onClick={() => {
              interruptPresentation();
              setStandby(true);
            }}
          >
            Hide Audience
          </Button>
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
              interruptPresentation();
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
        <label>
          Reveal batch size{' '}
          <select
            value={size}
            disabled={
              oneAtATime ||
              state.busy ||
              sequence.shuffling ||
              batchEnd > disclosed
            }
            onChange={(e) => setBatch(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        {oneAtATime && <p>One-at-a-time mode reveals one winner per batch.</p>}
        <h1 className="stage-title" tabIndex={-1} ref={heading}>
          {state.busy
            ? 'Preparing draw…'
            : replaying
              ? 'Replay'
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
        <div aria-live={replaying ? 'off' : 'polite'} aria-atomic="true">
          {sequence.shuffling && (
            <div
              className="stage-cards mystery-cards"
              data-paused={sequence.paused || undefined}
              aria-hidden="true"
            >
              {Array.from(
                {
                  length: replaying
                    ? disclosed - replayStart
                    : Math.min(6, count - disclosed),
                },
                (_, i) => (
                  <div key={i} className="mystery-ticket">
                    <span>✦</span>
                  </div>
                ),
              )}
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
                  data-flip={start + index >= flipFrom || undefined}
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
          {sequence.shuffling && (
            <>
              <Button onClick={sequence.togglePause}>
                {sequence.paused ? 'Resume animation' : 'Pause animation'}
              </Button>
              <Button
                className="primary-action"
                onClick={(event) => {
                  if (event.detail <= 1) sequence.skip();
                }}
              >
                Skip
              </Button>
            </>
          )}
          {!sequence.shuffling && disclosed > replayStart && (
            <Button disabled={state.busy} onClick={replay}>
              Replay Reveal
            </Button>
          )}
          {!sequence.shuffling && batchEnd > disclosed && (
            <Button
              onClick={() => {
                setReplaying(false);
                present(Math.min(batchEnd, disclosed + 6));
              }}
            >
              Show rest of batch
            </Button>
          )}
          {!sequence.shuffling && more && batchEnd <= disclosed && (
            <Button
              className="primary-action"
              onClick={(event) => {
                if (event.detail <= 1) {
                  reveal();
                }
              }}
            >
              {disclosed ? 'Reveal next batch' : 'Reveal'}
            </Button>
          )}
          {!sequence.shuffling && lastPage > 0 && (
            <>
              <Button
                disabled={currentPage === 0}
                onClick={() => {
                  setReplaying(false);
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
                  setReplaying(false);
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
