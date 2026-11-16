import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
  invalidatePreferencesBootstrap: vi.fn()
}));
vi.mock('../../src/core/apiClient', () => ({ requestJson: mocks.requestJson }));
const updateFeaturedCache = vi.hoisted(() => vi.fn());
vi.mock('../../src/core/featuredCache', () => ({
  getFeaturedCacheScope: () => 'server.user',
  updateFeaturedCache
}));
vi.mock('../../src/preferencesApi', () => ({ invalidatePreferencesBootstrap: mocks.invalidatePreferencesBootstrap }));
import {
  flushTrailerAudio,
  forgetSessionTrailerAudio,
  rememberTrailerAudio,
  withSessionTrailerAudio
} from '../../src/slider/trailerAudioPreference';
import type { FeaturedResponse } from '../../src/types/featured';

describe('trailer audio preference saving', () => {
  afterEach(() => {
    forgetSessionTrailerAudio();
    mocks.requestJson.mockReset();
    mocks.invalidatePreferencesBootstrap.mockReset();
    updateFeaturedCache.mockReset();
  });

  it('sends a waiting change immediately when flushed and resolves after the save', async () => {
    mocks.requestJson.mockResolvedValue({ ok: true });
    rememberTrailerAudio({ muted: false });
    rememberTrailerAudio({ volume: 40 });

    await flushTrailerAudio();

    expect(mocks.requestJson).toHaveBeenCalledTimes(1);
    expect(mocks.requestJson).toHaveBeenCalledWith('featured/preferences/trailer-audio', {
      method: 'PUT',
      body: { muted: false, volume: 40 }
    });
    expect(mocks.invalidatePreferencesBootstrap).toHaveBeenCalledTimes(1);
  });

  it('waits for a save that is already in flight and keeps saves in order', async () => {
    let finishFirst!: () => void;
    mocks.requestJson
      .mockReturnValueOnce(new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce({ ok: true });
    rememberTrailerAudio({ muted: true });
    const first = flushTrailerAudio();
    rememberTrailerAudio({ muted: false });
    const second = flushTrailerAudio();
    let settled = false;
    void second.then(() => (settled = true));

    await Promise.resolve();
    expect(mocks.requestJson).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishFirst();
    await Promise.all([first, second]);
    expect(mocks.requestJson.mock.calls.map(([, options]) => options.body)).toEqual([
      { muted: true },
      { muted: false }
    ]);
  });

  it('keeps session-only changes in memory without saving them or touching the reload cache', async () => {
    rememberTrailerAudio({ muted: false, volume: 25 }, { persist: false });
    await flushTrailerAudio();

    expect(mocks.requestJson).not.toHaveBeenCalled();
    expect(updateFeaturedCache).not.toHaveBeenCalled();
    const response = withSessionTrailerAudio({ startTrailersMuted: true } as FeaturedResponse);
    expect(response.startTrailersMuted).toBe(false);
    expect(response.trailerVolume).toBe(25);
  });
});
