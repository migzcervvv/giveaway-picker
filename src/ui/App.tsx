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
  const hidden = draws.some((draw) =>
    deriveState(draw.events).slots.some(
      (slot) =>
        slot.rank > (state.visible[draw.id] ?? draw.slots.length) &&
        (slot.role !== 'backup' || slot.status === 'standby'),
    ),
  );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">Giveaway Picker</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
          Runs on this device. Nothing is uploaded.
        </p>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            disabled={state.busy || hidden}
            onClick={() => openHistory(true)}
          >
            History
          </Button>
          {historyOpen && (
            <Button disabled={state.busy} onClick={() => openHistory(false)}>
              Return to raffle
            </Button>
          )}
        </div>
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
                onDraw={(ready) => void state.start(ready)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
