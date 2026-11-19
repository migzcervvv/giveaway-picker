import { afterEach, expect, test, vi } from 'vitest';
import { buildEntrants } from '@/engine';
import { BuildSupersededError, createBuildRunner } from './runner';
import type { WorkerLike } from './runner';
import type { BuildRequest } from './protocol';

const options = { dedupe: true, foldDiacritics: false };
const names = ['José', 'Jose', 'José', ''];
function worker() {
  const fake: WorkerLike = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  };
  return fake;
}
afterEach(() => vi.unstubAllGlobals());

test('inline processing is asynchronous and matches the worker path at 5001 names', async () => {
  const fake = worker();
  const createWorker = vi.fn(() => fake);
  const runner = createBuildRunner({ createWorker });
  let settled = false;
  const inline = runner.build(names, options).then((result) => {
    settled = true;
    return result;
  });
  expect(settled).toBe(false);
  expect(await inline).toEqual(buildEntrants(names, options));
  await runner.build(Array(5000).fill('A'), options);
  expect(createWorker).not.toHaveBeenCalled();
  const large = Array.from(
    { length: 5001 },
    (_, i) => names[i % names.length] ?? '',
  );
  const pending = runner.build(large, options);
  await Promise.resolve();
  expect(createWorker).toHaveBeenCalledTimes(1);
  const [request] = vi.mocked(fake.postMessage).mock.calls[0] ?? [];
  expect(request).toEqual({ id: 3, names: large, ...options });
  fake.onmessage?.({
    data: { id: 3, ok: true, result: buildEntrants(large, options) },
  });
  expect(await pending).toEqual(buildEntrants(large, options));
  expect(fake.terminate).toHaveBeenCalledTimes(1);
  expect(fake.onmessage).toBeNull();
});

test.each([
  'cancel',
  'supersede',
  'response-error',
  'worker-error',
  'post-error',
] as const)('terminates and rejects on %s', async (reason) => {
  const fake = worker();
  if (reason === 'post-error')
    vi.mocked(fake.postMessage).mockImplementation(() => {
      throw new Error('send');
    });
  const runner = createBuildRunner({ threshold: 0, createWorker: () => fake });
  const promise = runner.build(names, options);
  const rejection = expect(promise).rejects.toBeInstanceOf(
    reason === 'cancel' || reason === 'supersede'
      ? BuildSupersededError
      : Error,
  );
  await Promise.resolve();
  if (reason === 'cancel') runner.cancel();
  if (reason === 'supersede') await runner.build([], options);
  if (reason === 'response-error')
    fake.onmessage?.({ data: { id: 1, ok: false, message: 'Build failed' } });
  if (reason === 'worker-error') fake.onerror?.(new Error('Worker failed'));
  await rejection;
  expect(fake.terminate).toHaveBeenCalledTimes(1);
});

test('ignores stale messages and cancels inline jobs before they run', async () => {
  const fake = worker();
  const runner = createBuildRunner({ threshold: 0, createWorker: () => fake });
  let finished = false;
  const pending = runner.build(names, options).then((result) => {
    finished = true;
    return result;
  });
  await Promise.resolve();
  fake.onmessage?.({ data: { id: 99, ok: false, message: 'Old failure' } });
  await Promise.resolve();
  expect(finished).toBe(false);
  fake.onmessage?.({
    data: { id: 1, ok: true, result: buildEntrants(names, options) },
  });
  await pending;
  const canceled = runner.build([], options);
  const rejected =
    expect(canceled).rejects.toBeInstanceOf(BuildSupersededError);
  runner.dispose();
  await rejected;
  expect(() => runner.build(names, options)).toThrow('disposed');
});

test.each(['missing Worker', 'construction fails'])(
  'falls back when %s',
  async (mode) => {
    vi.stubGlobal('Worker', undefined);
    const runner = createBuildRunner({
      threshold: 0,
      ...(mode === 'construction fails'
        ? {
            createWorker: () => {
              throw new Error('Blocked');
            },
          }
        : {}),
    });
    expect(await runner.build(names, options)).toEqual(
      buildEntrants(names, options),
    );
  },
);

test('copies the request before asynchronous execution', async () => {
  const fake = worker();
  const runner = createBuildRunner({ threshold: 0, createWorker: () => fake });
  const input = ['Alice'];
  const opts = { ...options, update: () => undefined };
  const pending = runner.build(input, opts);
  input[0] = 'Bob';
  opts.dedupe = false;
  await Promise.resolve();
  const request = vi.mocked(fake.postMessage).mock
    .calls[0]?.[0] as BuildRequest;
  expect(request).toEqual({ id: 1, names: ['Alice'], ...options });
  fake.onmessage?.({
    data: { id: 1, ok: true, result: buildEntrants(request.names, request) },
  });
  await pending;
});

test('a terminated worker callback cannot settle or cancel the replacement job', async () => {
  const old = worker();
  const fresh = worker();
  const createWorker = vi
    .fn()
    .mockReturnValueOnce(old)
    .mockReturnValueOnce(fresh);
  const runner = createBuildRunner({ threshold: 0, createWorker });
  const first = runner.build(names, options);
  const rejection = expect(first).rejects.toBeInstanceOf(BuildSupersededError);
  await Promise.resolve();
  const oldCallback = old.onmessage;
  const next = runner.build(['New'], options);
  await Promise.resolve();
  oldCallback?.({
    data: { id: 1, ok: true, result: buildEntrants(names, options) },
  });
  fresh.onmessage?.({
    data: { id: 2, ok: true, result: buildEntrants(['New'], options) },
  });
  await rejection;
  expect(await next).toEqual(buildEntrants(['New'], options));
  expect(old.terminate).toHaveBeenCalledTimes(1);
  expect(fresh.terminate).toHaveBeenCalledTimes(1);
});
