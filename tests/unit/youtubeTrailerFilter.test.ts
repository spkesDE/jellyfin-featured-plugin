import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeaturedTrailer } from '../../src/types/featured';

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));
vi.mock('../../src/core/apiClient', () => ({ requestJson }));

import { shouldSkipYouTubeTrailer } from '../../src/slider/youtubeTrailerFilter';

const trailer: FeaturedTrailer = {
  type: 'remote',
  provider: 'youtube',
  videoId: 'example12345',
  youTubeQualityFilterEnabled: true
};

describe('YouTube trailer quality filter', () => {
  afterEach(() => {
    vi.useRealTimers();
    requestJson.mockReset();
  });

  it.each([
    ['sd', true],
    ['hd', false],
    ['unknown', false],
    [undefined, false],
    ['unexpected', false]
  ])('skips only confirmed SD metadata (%s)', async (quality, skip) => {
    requestJson.mockResolvedValue({ quality });
    expect(await shouldSkipYouTubeTrailer(trailer)).toBe(skip);
    expect(requestJson).toHaveBeenCalledWith('featured/trailers/youtube/example12345/quality');
  });

  it.each([
    { provider: 'direct' },
    { youTubeQualityFilterEnabled: false },
    { youTubeQualityFilterEnabled: undefined },
    { videoId: null }
  ])('does not request metadata when the filter is inapplicable: %j', async (change) => {
    expect(await shouldSkipYouTubeTrailer({ ...trailer, ...change })).toBe(false);
    expect(requestJson).not.toHaveBeenCalled();
  });

  it('allows playback on backend failures', async () => {
    requestJson.mockRejectedValue(new Error('offline'));
    expect(await shouldSkipYouTubeTrailer(trailer)).toBe(false);
  });

  it('allows playback if the backend does not respond in time', async () => {
    vi.useFakeTimers();
    requestJson.mockReturnValue(new Promise(() => undefined));
    const result = shouldSkipYouTubeTrailer(trailer);
    await vi.advanceTimersByTimeAsync(4500);
    expect(await result).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
