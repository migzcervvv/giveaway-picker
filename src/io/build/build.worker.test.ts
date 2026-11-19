import { afterEach, expect, test, vi } from 'vitest';
import { buildEntrants } from '@/engine';
import type { BuildRequest } from './protocol';

afterEach(() => vi.unstubAllGlobals());

test('handles real engine requests and reports errors with the matching id', async () => {
  const postMessage = vi.fn();
  vi.stubGlobal('postMessage', postMessage);
  vi.stubGlobal('onmessage', null);
  await import('./build.worker');
  const request: BuildRequest = {
    id: 8,
    names: ['A', 'a'],
    dedupe: true,
    foldDiacritics: false,
  };
  globalThis.onmessage?.call(
    window,
    new MessageEvent('message', { data: request }),
  );
  expect(postMessage).toHaveBeenLastCalledWith({
    id: 8,
    ok: true,
    result: buildEntrants(request.names, request),
  });
  globalThis.onmessage?.call(
    window,
    new MessageEvent('message', { data: { ...request, id: 9, names: [null] } }),
  );
  expect(postMessage).toHaveBeenLastCalledWith({
    id: 9,
    ok: false,
    message: expect.any(String),
  });
});
