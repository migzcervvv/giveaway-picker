import { useStore } from 'zustand';
import { deriveState } from '@/engine';
import { drawFlowStore } from '@/store/drawFlow';
import { Button } from '@/ui/components/Button';
import { WinnerRow } from '@/ui/components/WinnerRow';
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
            <WinnerRow
              key={slot.rank}
              slot={slot}
              winnerCount={record.config.winners}
              busy={state.busy}
              onAction={(action) => void state.act(record.id, action)}
            />
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
