import { AudienceStage, type Prize } from './screens/AudienceStage';
import { InputScreen } from './screens/InputScreen';
import { WinnersScreen } from './screens/WinnersScreen';
import { useStore } from 'zustand';
import { drawFlowStore } from '@/store/drawFlow';
import { Button } from './components/Button';
import { useState } from 'react';
import { deriveState } from '@/engine';
import { HistoryScreen } from './screens/HistoryScreen';

export function App({ flow = drawFlowStore }: { flow?: typeof drawFlowStore }) {
  const state = useStore(flow);
  const draws = useStore(state.session, (session) => session.draws);
  const active = draws.some(({ id }) => id === state.activeId);
  const [historyOpen, openHistory] = useState(false);
  const [audience, setAudience] = useState(false);
  const [prize, setPrize] = useState<Prize>('Minor');
  const [presented, setPresented] = useState<Record<string, number>>({});
  const hidden = draws.some((draw) =>
    deriveState(draw.events).slots.some(
      (slot) =>
        slot.rank > (state.visible[draw.id] ?? draw.slots.length) &&
        (slot.role !== 'backup' || slot.status === 'standby'),
    ),
  );
  if (audience)
    return (
      <AudienceStage
        flow={flow}
        prize={prize}
        setPrize={setPrize}
        shown={presented[state.activeId ?? ''] ?? 0}
        onReveal={(id, count) =>
          setPresented((previous) => ({
            ...previous,
            [id]: Math.max(previous[id] ?? 0, count),
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
                {draws.map(({ id }, index) => (
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
