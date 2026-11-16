import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestJson: vi.fn(), getApiClient: vi.fn() }));
vi.mock('../../src/core/apiClient', () => mocks);
import { invalidatePreferencesBootstrap, loadPreferencesBootstrap } from '../../src/preferencesApi';

describe('preferences bootstrap isolation', () => {
  beforeEach(() => {
    invalidatePreferencesBootstrap();
    mocks.getApiClient.mockReturnValue({ getCurrentUserId: () => 'administrator' });
    mocks.requestJson.mockReset();
  });

  it('keeps the signed-in user cache separate from fresh admin inspections', async () => {
    const own = { current: { hasOverrides: false } };
    const other = { current: { hasOverrides: true } };
    mocks.requestJson.mockResolvedValueOnce(own).mockResolvedValueOnce(other).mockResolvedValueOnce(other);
    expect(await loadPreferencesBootstrap()).toBe(own);
    expect(await loadPreferencesBootstrap('other-user')).toBe(other);
    expect(await loadPreferencesBootstrap()).toBe(own);
    expect(await loadPreferencesBootstrap('other-user')).toBe(other);
    expect(mocks.requestJson.mock.calls.map(([path]) => path)).toEqual([
      'featured/preferences/bootstrap',
      'featured/preferences/bootstrap?userId=other-user',
      'featured/preferences/bootstrap?userId=other-user'
    ]);
  });

  it('does not cache a response that was requested before an invalidation', async () => {
    let resolveStale!: (value: unknown) => void;
    const stale = { current: { hasOverrides: false } };
    const fresh = { current: { hasOverrides: true } };
    mocks.requestJson
      .mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)))
      .mockResolvedValueOnce(fresh);

    const preload = loadPreferencesBootstrap();
    invalidatePreferencesBootstrap();
    resolveStale(stale);
    expect(await preload).toBe(stale);

    expect(await loadPreferencesBootstrap()).toBe(fresh);
    expect(await loadPreferencesBootstrap()).toBe(fresh);
    expect(mocks.requestJson).toHaveBeenCalledTimes(2);
  });
});
