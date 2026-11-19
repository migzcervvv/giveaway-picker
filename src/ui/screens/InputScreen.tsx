import { useEffect, useId, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { useStore } from 'zustand';
import { eligiblePool, looksTabular } from '@/engine';
import type { BuildRunner } from '@/io/build/runner';
import { drawConfigStore } from '@/store/drawConfig';
import { sessionStore } from '@/store/session';
import { settingsStore } from '@/store/settings';
import { useListBuilder } from '@/ui/hooks/useListBuilder';
import { ImportPicker } from '@/ui/components/ImportPicker';
import { Button } from '@/ui/components/Button';
import { Section } from '@/ui/components/Section';
import { Stepper } from '@/ui/components/Stepper';
import { Switch } from '@/ui/components/Switch';

const format = new Intl.NumberFormat();
const lockMessage =
  'Mark every winner as called or no-show before changing the list.';

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function InputScreen({
  session = sessionStore,
  settings = settingsStore,
  counts = drawConfigStore,
  runner,
  onDraw,
  onAudience,
}: {
  session?: typeof sessionStore;
  settings?: typeof settingsStore;
  counts?: typeof drawConfigStore;
  runner?: BuildRunner;
  onAudience?: () => void;
  onDraw?: (ready: boolean) => void;
} = {}) {
  const list = useListBuilder({ session, settings, runner });
  const build = useStore(session, (state) => state.build);
  const buildOptions = useStore(session, (state) => state.buildOptions);
  const preferences = useStore(settings);
  const config = useStore(counts);
  const draws = useStore(session, (state) => state.draws);
  const poolSize = eligiblePool(
    build?.entrants ?? [],
    draws.map(({ events }) => events),
    preferences,
  ).length;
  const ready =
    !!build &&
    buildOptions.dedupe === preferences.dedupe &&
    buildOptions.foldDiacritics === preferences.foldDiacritics &&
    list.text === session.getState().rawText &&
    list.status !== 'building' &&
    list.status !== 'error';
  const lockId = useId();
  const inputId = useId();
  const [clipboardError, setClipboardError] = useState('');
  const [clampMessage, setClampMessage] = useState('');
  const previousPool = useRef(poolSize);
  useEffect(() => {
    if (list.status === 'building') return;
    const before = counts.getState();
    before.clamp(poolSize);
    const after = counts.getState();
    if (previousPool.current !== poolSize) {
      setClampMessage(
        before.winners !== after.winners || before.backups !== after.backups
          ? 'Counts adjusted to fit the entrant pool.'
          : '',
      );
    }
    previousPool.current = poolSize;
  }, [poolSize, counts, list.status]);

  function changeCount(kind: 'winners' | 'backups', value: number) {
    if (kind === 'winners') config.setWinners(value, poolSize);
    else config.setBackups(value, poolSize);
    const next = counts.getState();
    setClampMessage(
      next[kind] !== value ||
        (kind === 'winners' && next.backups !== config.backups)
        ? 'Counts adjusted to fit the entrant pool.'
        : '',
    );
  }
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (list.locked) return;
    const { selectionStart, selectionEnd, value } = event.currentTarget;
    const inserted = normalizeLineEndings(
      event.clipboardData.getData('text/plain'),
    );
    list.setText(
      value.slice(0, selectionStart) + inserted + value.slice(selectionEnd),
      {
        immediate: true,
        imported:
          session.getState().imported &&
          (selectionStart !== 0 || selectionEnd !== value.length),
      },
    );
  }
  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!list.isActive()) return;
      list.setText(normalizeLineEndings(text), { immediate: true });
      setClipboardError('');
    } catch {
      if (!list.isActive()) return;
      setClipboardError(
        'Clipboard access was blocked. Press Ctrl+V in the box.',
      );
    }
  }

  return (
    <div className="input-layout">
      <Section title="Entrant list" step={1}>
        <ImportPicker
          session={session}
          onApply={(text) =>
            list.setText(text, { immediate: true, imported: true })
          }
        />
        <label htmlFor={inputId} className="block text-sm">
          Entrants
        </label>
        <textarea
          id={inputId}
          value={list.text}
          readOnly={list.locked}
          aria-describedby={list.locked ? lockId : undefined}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Paste names, one per line"
          onChange={(event) =>
            list.setText(event.target.value, {
              imported: session.getState().imported,
            })
          }
          onPaste={paste}
          className="entrant-draft w-full resize-y border border-[var(--muted)] bg-[var(--surface)] p-5 text-base leading-7 placeholder:text-[var(--muted)]"
        />
        <div className="flex flex-wrap gap-3">
          {typeof navigator.clipboard?.readText === 'function' && (
            <Button
              disabled={list.locked}
              onClick={() => void pasteClipboard()}
            >
              Paste from clipboard
            </Button>
          )}
          <Button disabled={list.locked} onClick={list.clear}>
            Clear
          </Button>
        </div>
        {clipboardError && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {clipboardError}
          </p>
        )}
        {looksTabular(list.text) && (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Several columns detected. Each line is used as one name, including
            text after the tab.
          </p>
        )}
        {list.locked && (
          <p
            id={lockId}
            role="status"
            className="text-sm leading-relaxed text-[var(--accent)]"
          >
            {lockMessage}
          </p>
        )}
      </Section>
      <div className="setup-panels">
        <Section title="List summary">
          <div role="status" aria-live="polite" aria-atomic="true">
            {list.status === 'building' ? (
              <p>Building list…</p>
            ) : list.status === 'error' ? (
              <p className="text-[var(--danger)]">{list.error}</p>
            ) : build ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {(
                  [
                    ['Rows read', build.stats.rawCount],
                    ['Blanks dropped', build.stats.blankDropped],
                    ['Duplicates removed', build.stats.duplicatesRemoved],
                    ['Final entrants', build.stats.finalCount],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-[var(--muted)]">{label}</dt>
                    <dd
                      className={`mt-1 text-3xl tabular-nums ${label === 'Final entrants' ? 'text-[var(--accent)]' : ''}`}
                    >
                      {format.format(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[var(--muted)]">No names yet</p>
            )}
          </div>
          {build && (
            <>
              <div>
                <h3 className="mb-2 text-sm text-[var(--muted)]">
                  First 5 names
                </h3>
                <ol className="space-y-1 break-words text-sm">
                  {build.entrants.slice(0, 5).map(({ id, name }) => (
                    <li key={id}>{name}</li>
                  ))}
                </ol>
              </div>
              {build.duplicates.length > 0 && (
                <details className="text-sm">
                  <summary className="min-h-10 cursor-pointer py-2">
                    Removed duplicates
                  </summary>
                  <ul className="max-h-64 space-y-1 overflow-auto break-words py-2">
                    {build.duplicates.slice(0, 200).map(({ name, count }) => (
                      <li key={name}>
                        {name} × {format.format(count)}
                      </li>
                    ))}
                  </ul>
                  {build.duplicates.length > 200 && (
                    <p>+{format.format(build.duplicates.length - 200)} more</p>
                  )}
                </details>
              )}
            </>
          )}
        </Section>
        <Section title="Draw settings" step={2}>
          <p className="pool-count">
            {format.format(poolSize)} eligible entrants
          </p>
          <Stepper
            label="Winners"
            value={config.winners}
            min={1}
            max={Math.max(1, poolSize)}
            onChange={(value) => changeCount('winners', value)}
          />
          <Stepper
            label="Backups"
            value={config.backups}
            min={0}
            max={Math.max(0, poolSize - config.winners)}
            onChange={(value) => changeCount('backups', value)}
          />
          {clampMessage && (
            <p role="status" className="text-xs text-[var(--muted)]">
              {clampMessage}
            </p>
          )}
          <div className="space-y-2">
            <Switch
              label="Remove duplicate names"
              checked={preferences.dedupe}
              disabled={list.locked}
              describedBy={list.locked ? lockId : undefined}
              onChange={(dedupe) => preferences.update({ dedupe })}
            />
            <Switch
              label="Ignore accents when comparing"
              checked={preferences.foldDiacritics}
              disabled={list.locked}
              describedBy={list.locked ? lockId : undefined}
              onChange={(foldDiacritics) =>
                preferences.update({ foldDiacritics })
              }
            />
            <Switch
              label="Remove winners from the pool after they are called"
              checked={preferences.removeCalled}
              onChange={(removeCalled) => preferences.update({ removeCalled })}
            />
            <Switch
              label="Reveal one at a time"
              checked={preferences.oneAtATime}
              onChange={(oneAtATime) => preferences.update({ oneAtATime })}
            />
          </div>
          <Button
            className="primary-action"
            disabled={!ready || poolSize === 0 || !onDraw}
            onClick={() => onDraw?.(ready)}
          >
            Draw
          </Button>
          {onAudience && (
            <Button disabled={!ready || poolSize === 0} onClick={onAudience}>
              Audience View
            </Button>
          )}
          {!ready ? (
            <p className="text-sm text-[var(--muted)]">
              Enter names and wait for the current list to finish building.
            </p>
          ) : (
            poolSize === 0 && (
              <p>
                No eligible entrants remain. Resolve open draws or change the
                list after all winners are resolved.
              </p>
            )
          )}
        </Section>
      </div>
    </div>
  );
}
