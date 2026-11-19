import type { Command, ImportRunner, ImportWorkbook, ImportPreview, Response, Result } from './protocol';

export class ImportCancelledError extends Error {}
export function createImportRunner(makeWorker = () =>
  new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' })
): ImportRunner {
  let worker: Worker | undefined, ready = false, disposed = false, id = 0;
  let rejectPending: ((reason: unknown) => void) | undefined;
  function supersede() {
    id++;
    rejectPending?.(new ImportCancelledError('Import cancelled.'));
    rejectPending = undefined;
  }
  function close() {
    worker?.terminate();
    worker = undefined;
    ready = false;
  }
  function cancel() { supersede(); close(); }
  function send<T extends Result>(command: Command): Promise<T> {
    const active = worker;
    if (!active) return Promise.reject(new Error('Open a file first.'));
    supersede();
    const requestId = id;
    return new Promise((resolve, reject) => {
      rejectPending = reject;
      function fail(error: unknown) {
        if (worker !== active || id !== requestId) return;
        rejectPending = undefined;
        close();
        reject(error);
      }
      active.onerror = active.onmessageerror = () => fail(new Error('Import worker failed.'));
      active.onmessage = ({ data }: MessageEvent<Response>) => {
        if (requestId !== id || data.id !== requestId || active !== worker) return;
        if ('error' in data) return fail(new Error(data.error));
        rejectPending = undefined;
        if (command.kind === 'open') ready = true;
        // Each command has a single result shape in the worker protocol.
        resolve(data.value as T);
      };
      try { active.postMessage({ ...command, id }, command.kind === 'open' ? [command.bytes] : []); }
      catch (error) { fail(error); }
    });
  }
  return {
    open(file) {
      cancel();
      if (disposed) return Promise.reject(new ImportCancelledError('Import disposed.'));
      const opening = id;
      return new Promise<ImportWorkbook>((resolve, reject) => {
        rejectPending = reject;
        void Promise.resolve().then(() => file.arrayBuffer()).then(bytes => {
          if (id !== opening) return;
          worker = makeWorker();
          rejectPending = undefined;
          resolve(send<ImportWorkbook>({ kind: 'open', filename: file.name, bytes }));
        }).catch(error => {
          if (id !== opening) return;
          rejectPending = undefined;
          close();
          reject(error);
        });
      });
    },
    preview(sheet, hasHeader) {
      if (!ready) return Promise.reject(new Error('Open a file first.'));
      return send<ImportPreview>({ kind: 'preview', sheet, hasHeader });
    },
    extract(sheet, columnIndex, hasHeader) {
      if (!ready) return Promise.reject(new Error('Open a file first.'));
      return send<string[]>({ kind: 'extract', sheet, columnIndex, hasHeader });
    },
    cancel,
    dispose() { disposed = true; cancel(); },
  };
}
