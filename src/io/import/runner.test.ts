import { describe, expect, it, vi } from 'vitest';
import { createImportRunner, ImportCancelledError } from './runner';
import type { Request, Response } from './protocol';

function setup() {
  const worker = {
    onmessage: (_event: { data: Response }) => { void _event; },
    terminate: vi.fn(), postMessage: vi.fn<(request: Request, transfers: Transferable[]) => void>(),
  };
  const runner = createImportRunner(() => worker as unknown as Worker);
  const bytes = new ArrayBuffer(8);
  const file = { name: 'test.csv', arrayBuffer: async () => bytes } as File;
  function postedCall(index: number) {
    const call = worker.postMessage.mock.calls[index];
    if (!call) throw new Error(`Expected worker postMessage call at index ${index}.`);
    return call;
  }
  async function open() {
    const result = runner.open(file);
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
    const [request, transfers] = postedCall(0);
    expect(transfers).toEqual([bytes]);
    worker.onmessage({ data: { id: request.id, value: { sheets: [] } } });
    await expect(result).resolves.toEqual({ sheets: [] });
  }
  return { worker, runner, file, open, postedCall };
}
describe('import worker ownership', () => {
  it('matches responses by id and supersedes pending commands', async () => {
    const { runner, worker, open, postedCall } = setup();
    await open();
    const first = runner.preview('s', false);
    const second = runner.preview('s', true);
    await expect(first).rejects.toBeInstanceOf(ImportCancelledError);
    const ids = worker.postMessage.mock.calls.map(([request]) => request.id);
    expect(new Set(ids).size).toBe(3);
    worker.onmessage({ data: { id: postedCall(1)[0].id, error: 'late' } });
    const preview = { sheet: 's', hasHeader: true, columns: [], firstRows: [] };
    worker.onmessage({ data: { id: postedCall(2)[0].id, value: preview } });
    await expect(second).resolves.toEqual(preview);
    const result = runner.extract('s', 1, true);
    const [request] = postedCall(3);
    expect(request).toMatchObject({ kind: 'extract', columnIndex: 1 });
    worker.onmessage({ data: { id: request.id, value: ['a'] } });
    await expect(result).resolves.toEqual(['a']);
  });
  it.each(['cancel','dispose'] as const)('%s terminates pending work and ignores late replies', async action => {
    const { runner, worker, open, file, postedCall } = setup();
    await open();
    const pending = runner.extract('s', 0, false);
    runner[action]();
    worker.onmessage({ data: { id: postedCall(1)[0].id, value: ['late'] } });
    await expect(pending).rejects.toBeInstanceOf(ImportCancelledError);
    expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(runner.preview('s', false)).rejects.toThrow();
    if (action === 'dispose') await expect(runner.open(file)).rejects.toBeInstanceOf(ImportCancelledError);
  });
  it('replacing a slow file read cancels it before posting bytes', async () => {
    const { runner, worker, open } = setup();
    let release = () => {};
    const slow = runner.open({ arrayBuffer: () => new Promise<ArrayBuffer>(resolve => {
      release = () => resolve(new ArrayBuffer(0));
    }) } as File);
    await Promise.resolve();
    const cancelled = expect(slow).rejects.toBeInstanceOf(ImportCancelledError);
    await open();
    release();
    await cancelled;
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });
  it.each(['post','parse','read'])('propagates %s failures and drops the workbook', async reason => {
    const { runner, worker, file, postedCall } = setup();
    if (reason === 'post') worker.postMessage.mockImplementation(() => { throw new Error('post'); });
    const pending = runner.open(reason === 'read' ? { arrayBuffer: async () => { throw new Error('read'); } } as unknown as File : file);
    const failure = expect(pending).rejects.toThrow(reason);
    if (reason === 'parse') {
      await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
      worker.onmessage({ data: { id: postedCall(0)[0].id, error: 'parse' } });
    }
    await failure;
    if (reason !== 'read') expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(runner.extract('s', 0, false)).rejects.toThrow();
  });
});
