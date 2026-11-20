import { AudienceStage, type Prize } from './screens/AudienceStage';
import { InputScreen } from './screens/InputScreen';
import { WinnersScreen } from './screens/WinnersScreen';
import { useStore } from 'zustand';
import { drawFlowStore } from '@/store/drawFlow';
import { Button } from './components/Button';
import { useState } from 'react';
import { hasUnresolvedDraw } from '@/store/session';
import { deriveState } from '@/engine';
import { HistoryScreen } from './screens/HistoryScreen';

export function App({ flow = drawFlowStore }: { flow?: typeof drawFlowStore }) {
  const state = useStore(flow);
  const draws = useStore(state.session, (session) => session.draws);
  const active = draws.some(({ id }) => id === state.activeId);
  const [historyOpen, openHistory] = useState(false);
  const [audience, setAudience] = useState(false);
  const [standby, setStandby] = useState(false);
  const [prize, setPrize] = useState<Prize>('Minor');
  const [presented, setPresented] = useState<Record<string, number[]>>({});
  const [batch, setBatch] = useState<Partial<Record<Prize, number>>>({});
  const currentDraws = draws.filter(
    (draw) => draw.events.at(-1)?.type !== 'CANCELLED',
  );
  const hidden = currentDraws.some((draw) =>
    deriveState(draw.events).slots.some(
      (slot) =>
        slot.rank > (state.visible[draw.id] ?? draw.slots.length) &&
        (slot.role !== 'backup' || slot.status === 'standby'),
    ),
  );
  const [control, setControl] = useState<{
    id: string | null;
    generation: symbol;
    restart: boolean;
  } | null>(null);
  const latest = draws.at(-1);
  const openControls = () =>
    setControl({
      id: state.activeId,
      generation: state.session.getState().generation,
      restart:
        !!latest && latest.id === state.activeId && hasUnresolvedDraw([latest]),
    });
  if (control) {
    const finish = async (mode: 'restart' | 'keep' | 'clear') => {
      if (flow.getState().busy) return;
      await state.finish(mode, control.id, control.generation);
      if (flow.getState().error) return;
      if (mode !== 'restart') setPresented({});
      setAudience(false);
      openHistory(false);
      setControl(null);
    };
    return (
      <main className="app-shell">
        <section className="panel space-y-4">
          <h1 className="panel-title">Round and session controls</h1>
          <p>Switch the projector away if it mirrors this screen.</p>
          {control.restart && (
            <>
              <p>
                Restart cancels this round and keeps its history. Unawarded
                places return to the pool. Called and no-show rules still apply.
              </p>
              <Button
                disabled={state.busy}
                onClick={() => void finish('restart')}
              >
                Confirm restart round
              </Button>
            </>
          )}
          <p>
            Reset cancels all open rounds and preserves History. Keeping the
            roster starts a fresh session where earlier winners can win again.
            Clearing it also empties input.
          </p>
          <Button disabled={state.busy} onClick={() => void finish('keep')}>
            Reset session — keep roster
          </Button>
          <Button disabled={state.busy} onClick={() => void finish('clear')}>
            Reset session — clear roster
          </Button>
          <Button disabled={state.busy} onClick={() => setControl(null)}>
            Go back
          </Button>
          {state.error && (
            <p role="alert">Operation incomplete. Retry to finish.</p>
          )}
        </section>
      </main>
    );
  }
  if (audience)
    return (
      <AudienceStage
        standby={standby}
        setStandby={setStandby}
        onControls={openControls}
        key={state.activeId}
        flow={flow}
        prize={prize}
        setPrize={setPrize}
        pages={presented[state.activeId ?? ''] ?? []}
        batch={batch[prize]}
        setBatch={(value) =>
          setBatch((prior) => ({ ...prior, [prize]: value }))
        }
        onReveal={(id, count) =>
          setPresented((previous) => ({
            ...previous,
            [id]: [...(previous[id] ?? []).filter((end) => end < count), count],
          }))
        }
        onExit={() => setAudience(false)}
      />
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="masthead">
        <div>
          <h1 className="brand">
            <span aria-hidden="true" className="ticket-mark">
              ✦
            </span>
            The Lucky Draw
          </h1>
          <p className="privacy-note">
            Runs on this device. Nothing is uploaded.
          </p>
        </div>
        <nav aria-label="Operator navigation" className="flex flex-wrap gap-2">
          <Button disabled={state.busy} onClick={openControls}>
            Round and session controls
          </Button>
          {active && !historyOpen && (
            <Button disabled={state.busy} onClick={() => setAudience(true)}>
              Audience View
            </Button>
          )}
          {historyOpen && (
            <Button disabled={state.busy} onClick={() => openHistory(false)}>
              Return to raffle
            </Button>
          )}
          <Button
            aria-current={historyOpen ? 'page' : undefined}
            disabled={state.busy || hidden || historyOpen}
            onClick={() => openHistory(true)}
          >
            History
          </Button>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {hidden && <p>Reveal every selected slot before opening History.</p>}
        <p role="status" aria-live="polite" aria-atomic="true">
          {state.announcement}
        </p>
        {state.error && (
          <p role="alert" className="my-4 text-[var(--danger)]">
            {state.error} Retry the action when ready.
          </p>
        )}
        {state.busy ? (
          <p role="status">Preparing draw…</p>
        ) : (
          <>
            {!historyOpen && draws.length > 0 && (
              <nav
                aria-label="Current session draws"
                className="mb-6 flex flex-wrap gap-3"
              >
                <Button onClick={() => state.show(null)}>Input</Button>
                {currentDraws.map(({ id }, index) => (
                  <Button
                    key={id}
                    aria-pressed={id === state.activeId}
                    onClick={() => state.show(id)}
                  >
                    Draw {index + 1}
                  </Button>
                ))}
              </nav>
            )}
            {historyOpen && !hidden ? (
              <HistoryScreen flow={flow} />
            ) : active ? (
              <WinnersScreen flow={flow} />
            ) : (
              <InputScreen
                session={state.session}
                settings={state.settings}
                counts={state.counts}
                onAudience={() => setAudience(true)}
                onDraw={(ready) => void state.start(ready)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
