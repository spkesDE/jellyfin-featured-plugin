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
});
