import { useStore } from 'zustand';
import { deriveState } from '@/engine';
import { drawFlowStore } from '@/store/drawFlow';
import { Button } from '@/ui/components/Button';
import { Section } from '@/ui/components/Section';

export function WinnersScreen({
  flow = drawFlowStore,
}: {
  flow?: typeof drawFlowStore;
}) {
  const state = useStore(flow);
  const draws = useStore(state.session, (session) => session.draws);
  const record = draws.find(({ id }) => id === state.activeId);
  if (!record) return null;
  const derived = deriveState(record.events);
  const visible = state.visible[record.id] ?? record.slots.length;
  return (
    <Section title="Draw results" step={3}>
      <p className="break-all text-sm text-[var(--muted)]">
        Draw {record.id} · {record.createdAt}
      </p>
      <ol className="space-y-6">
        {derived.slots
          .filter(
            (slot) =>
              slot.rank <= visible ||
              (slot.role === 'backup' && slot.status !== 'standby'),
          )
          .map((slot) => (
            <li key={slot.rank} className="winner-row space-y-3">
              <p>
                {slot.role === 'winner'
                  ? `Winner ${slot.rank}`
                  : `Backup ${slot.rank - record.config.winners}`}{' '}
                · {slot.status.replace('_', '-')}
              </p>
              <p dir="auto" className="break-words font-display text-4xl">
                {slot.name}
              </p>
              {(slot.status === 'pending' || slot.status === 'promoted') && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="primary-action"
                    aria-label={`Mark ${slot.name} called`}
                    disabled={state.busy}
                    onClick={() =>
                      void state.act(record.id, {
                        type: 'CALLED',
                        rank: slot.rank,
                      })
                    }
                  >
                    Mark called
                  </Button>
                  <Button
                    aria-label={`Mark ${slot.name} no-show`}
                    disabled={state.busy}
                    onClick={() =>
                      void state.act(record.id, {
                        type: 'NO_SHOW',
                        rank: slot.rank,
                      })
                    }
                  >
                    No-show
                  </Button>
                </div>
              )}
            </li>
          ))}
      </ol>
      {derived.exhausted.length > 0 && (
        <p>No backup remains for slot {derived.exhausted.join(', ')}.</p>
      )}
      <div className="flex flex-wrap gap-3">
        {derived.slots.some(
          (slot) =>
            slot.rank > visible &&
            (slot.role !== 'backup' || slot.status === 'standby'),
        ) && (
          <Button disabled={state.busy} onClick={() => state.next(record.id)}>
            Next
          </Button>
        )}
        <Button
          disabled={state.busy || !state.canUndo(record.id)}
          onClick={() => void state.act(record.id, { type: 'UNDO' })}
        >
          Undo
        </Button>
        <Button disabled={state.busy} onClick={() => state.show(null)}>
          Next round / Return to input
        </Button>
      </div>
    </Section>
  );
}
