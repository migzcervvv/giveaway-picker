import type { Slot, SlotStatus } from '@/engine';
import { Button } from './Button';

export function WinnerRow({
  slot,
  winnerCount,
  busy,
  onAction,
}: {
  slot: Slot & { status: SlotStatus };
  winnerCount: number;
  busy: boolean;
  onAction(action: { type: 'CALLED' | 'NO_SHOW'; rank: number }): void;
}) {
  return (
    <li className="winner-row space-y-3">
      <p>
        {slot.role === 'winner'
          ? `Winner ${slot.rank}`
          : `Backup ${slot.rank - winnerCount}`}{' '}
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
            disabled={busy}
            onClick={() =>
              onAction({
                type: 'CALLED',
                rank: slot.rank,
              })
            }
          >
            Mark called
          </Button>
          <Button
            aria-label={`Mark ${slot.name} no-show`}
            disabled={busy}
            onClick={() =>
              onAction({
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
  );
}
