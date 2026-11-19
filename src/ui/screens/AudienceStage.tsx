import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { deriveState } from '@/engine';
import type { drawFlowStore } from '@/store/drawFlow';
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
  const state = useStore(flow);
  const record = useStore(state.session, (s) =>
    s.draws.find((d) => d.id === state.activeId),
  );
  const oneAtATime = useStore(state.settings, (s) => s.oneAtATime);
  const [shielded, setShielded] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [shielded]);
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

  function reveal() {
    if (!record || state.busy || !more) return;
    const count = Math.min(
      (Math.floor(disclosed / size) + 1) * size,
      slots.length,
    );
    const nextSlot = slots[count - 1];
    if (nextSlot?.role === 'winner' && nextSlot.rank > visible)
      state.next(record.id);
    onReveal(record.id, count);
    setPage(Math.floor((count - 1) / size));
  }

  if (shielded)
    return (
      <main className="audience-stage">
        <h1 className="stage-title" tabIndex={-1} ref={heading}>
          Reveal pending
        </h1>
        <p>
          Return to the audience to reveal the remaining winners before opening
          the operator controls.
        </p>
        <Button className="primary-action" onClick={() => setShielded(false)}>
          Resume Audience View
        </Button>
      </main>
    );
  return (
    <main className="audience-stage" aria-label="Audience View">
      <header className="stage-bar">
        <span className="font-display text-3xl">The Lucky Draw</span>
        <Button
          disabled={state.busy}
          onClick={() => (more ? setShielded(true) : onExit())}
        >
          Return to operator
        </Button>
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
          {cards.length > 0 && (
            <ol className="stage-cards">
              {cards.map((slot) => (
                <li key={slot.rank}>
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
            <Button className="primary-action" onClick={reveal}>
              {disclosed ? 'Reveal next batch' : 'Reveal'}
            </Button>
          )}
          {lastPage > 0 && (
            <>
              <Button
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous page
              </Button>
              <span>
                Page {currentPage + 1} of {lastPage + 1}
              </span>
              <Button
                disabled={currentPage >= lastPage}
                onClick={() => setPage(currentPage + 1)}
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
