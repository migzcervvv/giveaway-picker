import { buildEntrants } from '@/engine';
import type { BuildResult } from '@/engine';
import type { BuildOptions, BuildRequest, BuildResponse } from './protocol';

export class BuildSupersededError extends Error {}
export interface WorkerLike {
  postMessage(message: BuildRequest): void;
  terminate(): void;
  onmessage: ((event: { data: BuildResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
export interface BuildRunner {
  build(names: readonly string[], options: BuildOptions): Promise<BuildResult>;
  cancel(): void;
  dispose(): void;
}

export function createBuildRunner(
  config: {
    threshold?: number;
    createWorker?: () => WorkerLike;
  } = {},
): BuildRunner {
  let nextId = 0;
  let disposed = false;
  let cancelPending: (() => void) | undefined;
  const createWorker =
    config.createWorker ??
    (() =>
      // Worker messages carry this protocol. The runner uses only data from MessageEvent.
      new Worker(new URL('./build.worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerLike);

  function cancel() {
    cancelPending?.();
  }

  return {
    build(names, options) {
      if (disposed) throw new Error('Build runner is disposed');
      cancel();
      const id = ++nextId;
      const copiedNames = [...names];
      const copiedOptions = {
        dedupe: options.dedupe,
        foldDiacritics: options.foldDiacritics,
      };
      return new Promise((resolve, reject) => {
        let worker: WorkerLike | undefined;
        let settled = false;
        function finish(error: Error | null, result?: BuildResult) {
          if (settled) return;
          settled = true;
          if (worker) {
            worker.onmessage = null;
            worker.onerror = null;
            worker.terminate();
          }
          cancelPending = undefined;
          if (error) reject(error);
          else resolve(result as BuildResult);
        }
        cancelPending = () =>
          finish(new BuildSupersededError('Build superseded'));
        // Even inline processing starts after build() returns, allowing cancellation.
        queueMicrotask(() => {
          if (settled) return;
          if (copiedNames.length > (config.threshold ?? 5000)) {
            try {
              worker = createWorker();
            } catch {
              // Worker construction can fail in restricted browsers. Use the engine inline.
            }
          }
          if (worker) {
            worker.onmessage = ({ data }) => {
              if (data.id !== id) return;
              if (data.ok) finish(null, data.result);
              else finish(new Error(data.message));
            };
            worker.onerror = () =>
              finish(new Error('List build worker failed'));
            try {
              worker.postMessage({ id, names: copiedNames, ...copiedOptions });
            } catch {
              finish(new Error('Unable to send list to build worker'));
            }
          } else {
            try {
              finish(null, buildEntrants(copiedNames, copiedOptions));
            } catch (error) {
              finish(
                error instanceof Error
                  ? error
                  : new Error('Unable to build the list'),
              );
            }
          }
        });
      });
    },
    cancel,
    dispose() {
      cancel();
      disposed = true;
    },
  };
}
