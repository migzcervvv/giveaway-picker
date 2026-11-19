import { InputScreen } from './screens/InputScreen';

export function App() {
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
        <InputScreen />
      </main>
    </div>
  );
}
