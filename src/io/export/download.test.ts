import { afterEach, expect, test, vi } from 'vitest';
import { downloadRecord } from './record';
import { savedRecord } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test.each(['json', 'csv', 'xlsx'] as const)(
  '%s downloads use safe filenames and release object URLs without storage writes',
  async (format) => {
    vi.useFakeTimers();
    const record = await savedRecord({ id: '../../a\\b:<name> 雪' });
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:local');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    const store = vi.spyOn(Storage.prototype, 'setItem');
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    await downloadRecord(record, format);
    expect(filename).toMatch(new RegExp(`^draw-[A-Za-z0-9_-]+\\.${format}$`));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.length).toBe(1);
    expect(create.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(document.querySelector('a[download]')).toBeNull();
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:local');
    expect(store).not.toHaveBeenCalled();
  },
);
test('a click failure still removes the anchor and releases its object URL', async () => {
  vi.useFakeTimers();
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:failed';
      static revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    throw new Error('Download blocked');
  });
  await expect(downloadRecord(await savedRecord(), 'json')).rejects.toThrow(
    'Download blocked',
  );
  await vi.runAllTimersAsync();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:failed');
  expect(document.querySelector('a[download]')).toBeNull();
});
