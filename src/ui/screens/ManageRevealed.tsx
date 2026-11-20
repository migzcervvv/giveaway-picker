import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { DrawRecord, Slot, SlotStatus } from '@/engine';
import type { drawFlowStore } from '@/store/drawFlow';
import { WinnerRow } from '../components/WinnerRow';
import { Button } from '../components/Button';

export function ManageRevealed({
  flow,
  record,
  revealed,
  stillCurrent,
  onResume,
}: {
  flow: typeof drawFlowStore;
  record?: DrawRecord;
  revealed: (Slot & { status: SlotStatus })[];
  stillCurrent(): boolean;
  onResume(): void;
}) {
  const state = useStore(flow);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  // The engine selects the undo target. Only expose it for a disclosed rank.
  let undoAllowed = false;
  if (record && state.canUndo(record.id)) {
    const [undo] = state.session
      .getState()
      .prepareAction(record.id, { type: 'UNDO' }, '', () => 'preview');
    const target =
      undo?.type === 'UNDONE' &&
      record.events.find((event) => event.id === undo.targetEventId);
    undoAllowed =
      !!target &&
      'rank' in target &&
      revealed.some((slot) => slot.rank === target.rank);
  }
  return (
    <main className="app-shell space-y-6">
      <h1 className="font-display text-4xl" tabIndex={-1} ref={heading}>
        Manage revealed winners
      </h1>
      <Button
        className="primary-action"
        disabled={state.busy}
        onClick={onResume}
      >
        Resume Audience View
      </Button>
      {record && revealed.length > 0 ? (
        <>
          <ol className="space-y-6">
            {revealed.map((slot) => (
              <WinnerRow
                key={slot.rank}
                slot={slot}
                winnerCount={record.config.winners}
                busy={state.busy}
                onAction={(action) => {
                  if (stillCurrent()) void state.act(record.id, action);
                }}
              />
            ))}
          </ol>
          <Button
            disabled={state.busy || !undoAllowed}
            onClick={() => {
              if (stillCurrent() && undoAllowed)
                void state.act(record.id, { type: 'UNDO' });
            }}
          >
            Undo
          </Button>
        </>
      ) : (
        <p>No winners revealed yet.</p>
      )}
      <p role="status">{state.busy ? 'Saving…' : ''}</p>
      {state.error && (
        <p role="alert">
          The action could not be completed. Check the displayed status before
          retrying.
        </p>
      )}
    </main>
  );
}
