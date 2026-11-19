import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { deriveState } from '@/engine';
import { drawFlowStore } from '@/store/drawFlow';
import { downloadRecord } from '@/io/export/record';
import { Button } from '../components/Button';
import { Section } from '../components/Section';

export function HistoryScreen({
  flow = drawFlowStore,
}: {
  flow?: typeof drawFlowStore;
}) {
  const { history, session, busy } = useStore(flow);
  const { records, loading } = useStore(history);
  const draws = useStore(session, (state) => state.draws);
  const [selected, select] = useState<string | null>(null);
  const [confirmation, confirm] = useState<{ id?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const retry = useRef<() => void>(() => {});
  async function run(operation: () => Promise<void>) {
    setWorking(true);
    setError('');
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operation failed');
      retry.current = () => void run(operation);
    } finally {
      setWorking(false);
    }
  }
  useEffect(() => {
    void run(async () => {
      await history.getState().load();
      setLoaded(true);
    });
  }, [history]);
  const record = records.find(({ id }) => id === selected);
  const locked = busy || loading || working;
  const linked = (id: string) => draws.some((draw) => draw.id === id);
  async function remove(id?: string) {
    if (
      flow.getState().busy ||
      session
        .getState()
        .draws.some((draw) => id === undefined || draw.id === id)
    )
      throw new Error(
        'Clear the current session after resolving active winners before deleting its records.',
      );
    if (id === undefined) await history.getState().clear();
    else await history.getState().remove(id);
    confirm(null);
  }
  return (
    <Section title="History">
      {(loading || working) && <p role="status">Working on history…</p>}
      {error && (
        <div role="alert">
          {error}{' '}
          <Button disabled={locked} onClick={() => retry.current()}>
            Retry
          </Button>
        </div>
      )}
      {loaded && (
        <>
          <Button
            disabled={locked || draws.length > 0 || records.length === 0}
            onClick={() => confirm({})}
          >
            Clear all history
          </Button>
          {draws.length > 0 && (
            <p>
              Resolve active winners, then clear the current session before
              deleting its records. Other archived records can be deleted.
            </p>
          )}
          {confirmation && (
            <div role="alertdialog" aria-label="Confirm history deletion">
              <p>
                {confirmation.id
                  ? 'Delete this archived record?'
                  : 'Delete all stored draw records?'}{' '}
                This cannot be undone.
              </p>
              <Button
                disabled={locked}
                onClick={() => void run(() => remove(confirmation.id))}
              >
                Confirm deletion
              </Button>
              <Button
                autoFocus
                disabled={locked}
                onClick={() => {
                  confirm(null);
                  setError('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}
          {records.length === 0 ? (
            <p>No saved draws.</p>
          ) : (
            <ul className="space-y-5">
              {records.map((draw) => (
                <li key={draw.id} className="space-y-2 break-words">
                  <Button
                    disabled={locked}
                    aria-label={`View draw ${draw.id}`}
                    onClick={() => select(draw.id)}
                  >
                    {draw.createdAt}
                  </Button>
                  <p>
                    {draw.entrantCount} entrants · {draw.config.winners} winners
                    · {draw.config.backups} backups
                  </p>
                  <p>
                    {deriveState(draw.events)
                      .slots.map((slot) => `${slot.name}: ${slot.status}`)
                      .join('; ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {record && (
            <Section title="Draw record">
              <p>Archived record — read only</p>
              <dl className="space-y-2 break-all text-sm">
                <dt>Draw ID</dt>
                <dd>{record.id}</dd>
                <dt>Full-list SHA-256</dt>
                <dd>{record.listHash}</dd>
                <dt>Normalization version</dt>
                <dd>{record.normalizationVersion}</dd>
                <dt>Configuration</dt>
                <dd>{JSON.stringify(record.config)}</dd>
                <dt>Counts</dt>
                <dd>
                  {record.entrantCount} entrants; {record.rawCount} raw;{' '}
                  {record.blankDropped} blanks; {record.duplicatesRemoved}{' '}
                  duplicates removed
                </dd>
              </dl>
              <ol className="space-y-2 break-words">
                {deriveState(record.events).slots.map((slot) => (
                  <li key={slot.rank}>
                    {slot.role} {slot.rank}: {slot.name} — {slot.status}
                  </li>
                ))}
              </ol>
              {deriveState(record.events).exhausted.length > 0 && (
                <p>
                  No backup remains for slot{' '}
                  {deriveState(record.events).exhausted.join(', ')}.
                </p>
              )}
              <h3>Event log (recorded order)</h3>
              <ol className="space-y-2 break-words text-sm">
                {record.events.map((event) => (
                  <li key={event.id}>{JSON.stringify(event)}</li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-3">
                {(['json', 'csv', 'xlsx'] as const).map((format) => (
                  <Button
                    key={format}
                    disabled={locked}
                    onClick={() =>
                      void run(() => downloadRecord(record, format))
                    }
                  >
                    Download {format.toUpperCase()}
                  </Button>
                ))}
                <Button
                  disabled={locked || linked(record.id)}
                  onClick={() => confirm({ id: record.id })}
                >
                  Delete record
                </Button>
              </div>
            </Section>
          )}
        </>
      )}
    </Section>
  );
}
