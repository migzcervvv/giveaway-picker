import type { RefObject } from 'react';
import { useStore } from 'zustand';
import type { deriveState, DrawRecord } from '@/engine';
import type { drawFlowStore } from '@/store/drawFlow';
import { Button } from '../components/Button';

type Slots = ReturnType<typeof deriveState>['slots'];

export function RevealedWinners({
  flow,
  record,
  slots,
  heading,
  onResume,
  onControls,
}: {
  flow: typeof drawFlowStore;
  record?: DrawRecord;
  slots: Slots;
  heading: RefObject<HTMLHeadingElement | null>;
  onResume(): void;
  onControls(): void;
}) {
  const state = useStore(flow);
  function current() {
    const live = flow.getState();
    return (
      record &&
      !live.busy &&
      live.activeId === record.id &&
      live.session.getState().draws.includes(record)
    );
  }
  function mark(rank: number, type: 'CALLED' | 'NO_SHOW') {
    if (
      !record ||
      !current() ||
      !slots.some(
        (slot) =>
          slot.rank === rank &&
          (slot.status === 'pending' || slot.status === 'promoted'),
      )
    )
      return;
    void state.act(record.id, { type, rank });
  }
  function canUndoShownAction() {
    if (!record || !current()) return false;
    try {
      const [undo] = state.session
        .getState()
        .prepareAction(record.id, { type: 'UNDO' }, '', () => 'preview');
      if (undo?.type !== 'UNDONE') return false;
      const target = record.events.find(
        (event) => event.id === undo.targetEventId,
      );
      return (
        (target?.type === 'CALLED' || target?.type === 'NO_SHOW') &&
        slots.some((slot) => slot.rank === target.rank)
      );
    } catch {
      return false;
    }
  }

  return (
    <main className="app-shell">
      <section className="panel space-y-4">
        <h1 className="panel-title" ref={heading} tabIndex={-1}>
          Manage revealed winners
        </h1>
        <Button
          className="primary-action"
          disabled={state.busy}
          onClick={onResume}
        >
          Resume Audience View
        </Button>
        <Button disabled={state.busy} onClick={onControls}>
          Round and session controls
        </Button>
        <p>
          Switch the projector away before opening operator controls on a
          mirrored display.
        </p>
        {slots.length === 0 && (
          <p>
            Reveal a winner on the audience screen to manage their status here.
          </p>
        )}
        <ol className="space-y-4">
          {slots.map((slot) => (
            <li key={slot.rank} className="winner-row space-y-2">
              <p className="break-words font-display text-3xl" dir="auto">
                {slot.name}
              </p>
              <p role="status">
                {slot.status === 'pending'
                  ? 'Awaiting call'
                  : slot.status.replace('_', '-')}
              </p>
              {(slot.status === 'pending' || slot.status === 'promoted') && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={state.busy}
                    aria-label={'Mark ' + slot.name + ' called'}
                    onClick={() => mark(slot.rank, 'CALLED')}
                  >
                    Mark called
                  </Button>
                  <Button
                    disabled={state.busy}
                    aria-label={'Mark ' + slot.name + ' no-show'}
                    onClick={() => mark(slot.rank, 'NO_SHOW')}
                  >
                    No-show
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {slots.length > 0 && (
          <Button
            disabled={!canUndoShownAction()}
            onClick={() => {
              if (record && canUndoShownAction())
                void state.act(record.id, { type: 'UNDO' });
            }}
          >
            Undo
          </Button>
        )}
        {state.error && (
          <p role="alert">
            Unable to save the change. Check the displayed status before
            retrying.
          </p>
        )}
      </section>
    </main>
  );
}
