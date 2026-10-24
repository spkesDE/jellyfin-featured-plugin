import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestJson: vi.fn(), getApiClient: vi.fn() }));
vi.mock('../../src/core/apiClient', () => mocks);
vi.mock('../../src/config/libs/jellyfinApi', () => ({
  loadUsers: async () => [],
  loadRatings: async () => [],
  loadLibrariesAndCollections: async () => ({})
}));

import { createConfigStore } from '../../src/config/libs/store';

describe('configuration YouTube API key status', () => {
  beforeEach(() => {
    mocks.getApiClient.mockReturnValue({ getPluginConfiguration: async () => ({}) });
    mocks.requestJson.mockReset();
  });

  it.each([true, false])('loads key presence (%s) without persisting it as configuration', async (apiKeyConfigured) => {
    mocks.requestJson.mockResolvedValue({ apiKeyConfigured });
    const store = createConfigStore();
    expect(store.youTubeApiKeyConfigured.value).toBeNull();
    await store.loadConfig();
    expect(mocks.requestJson).toHaveBeenCalledWith('featured/config/youtube-api-key');
    expect(store.youTubeApiKeyConfigured.value).toBe(apiKeyConfigured);
    expect(store.config).not.toHaveProperty('youTubeApiKeyConfigured');
    expect(store.saveState.value).toBe('clean');
  });

  it('keeps status unknown when the backend check fails', async () => {
    mocks.requestJson.mockRejectedValue(new Error('offline'));
    const store = createConfigStore();
    await store.loadConfig();
    expect(store.youTubeApiKeyConfigured.value).toBeNull();
  });

  it('does not interpret an older or malformed backend response as a missing key', async () => {
    mocks.requestJson.mockResolvedValue({});
    const store = createConfigStore();
    await store.loadConfig();
    expect(store.youTubeApiKeyConfigured.value).toBeNull();
  });

  it('rechecks the status when configuration is reopened', async () => {
    let configured = false;
    mocks.requestJson.mockImplementation(async () => ({ apiKeyConfigured: configured }));
    const store = createConfigStore();
    await store.loadConfig();
    expect(store.youTubeApiKeyConfigured.value).toBe(false);
    configured = true;
    await store.loadConfig();
    expect(store.youTubeApiKeyConfigured.value).toBe(true);
  });
});
