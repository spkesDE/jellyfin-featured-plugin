import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeaturedItem, FeaturedResponse, FeaturedTrailer } from '../../src/types/featured';
import type { TrailerPlaybackOptions } from '../../src/slider/trailerTypes';

const mocks = vi.hoisted(() => ({ createTrailerPlayer: vi.fn(), requestJson: vi.fn() }));
vi.mock('../../src/core/apiClient', () => ({ requestJson: mocks.requestJson }));
vi.mock('../../src/slider/trailer', () => ({
  createTrailerPlayer: mocks.createTrailerPlayer,
  isMobileTrailerClient: () => false
}));

import { TrailerController } from '../../src/slider/trailerController';

const youtube = (videoId: string): FeaturedTrailer => ({
  type: 'remote',
  provider: 'youtube',
  videoId,
  youTubeQualityFilterEnabled: true
});

describe('YouTube quality filter playback fallback', () => {
  let controller: TrailerController;
  let activeIndex: number;
  let restartAutoplay: ReturnType<typeof vi.fn>;
  const slide = document.createElement('article');
  const item = (trailers: FeaturedTrailer[]): FeaturedItem => ({ id: 'movie', trailers }) as FeaturedItem;

  beforeEach(() => {
    vi.useFakeTimers();
    activeIndex = 0;
    restartAutoplay = vi.fn();
    mocks.requestJson.mockReset();
    mocks.createTrailerPlayer.mockReset().mockImplementation(() => ({
      element: document.createElement('div'),
      play: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      setMuted: vi.fn(),
      setVolume: vi.fn()
    }));
    controller = new TrailerController(
      {
        enableBackgroundTrailers: true,
        allowTrailersOnMobile: true,
        trailerDelayMilliseconds: 0
      } as FeaturedResponse,
      true,
      null,
      null,
      {
        getActiveIndex: () => activeIndex,
        isDestroyed: () => false,
        isAutoplayEnabled: () => true,
        advance: vi.fn(),
        pauseAutoplay: vi.fn(),
        restartAutoplay
      }
    );
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  it('checks candidates before creating players and skips SD through the fallback chain', async () => {
    mocks.requestJson.mockResolvedValueOnce({ quality: 'sd' }).mockResolvedValueOnce({ quality: 'hd' });
    controller.start(slide, item([youtube('sd123456789'), youtube('hd123456789')]));
    expect(mocks.createTrailerPlayer).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mocks.requestJson).toHaveBeenCalledTimes(2);
    expect(mocks.createTrailerPlayer).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ videoId: 'hd123456789' }),
      expect.anything()
    );
    expect(restartAutoplay).not.toHaveBeenCalled();
  });

  it('restarts carousel autoplay when every candidate is SD', async () => {
    mocks.requestJson.mockResolvedValue({ quality: 'sd' });
    controller.start(slide, item([youtube('sd123456789'), youtube('sd987654321')]));
    await vi.runAllTimersAsync();
    expect(mocks.createTrailerPlayer).not.toHaveBeenCalled();
    expect(restartAutoplay).toHaveBeenCalledOnce();
  });

  it.each(['unknown', 'hd'])(
    'allows %s quality and preserves playback-error fallback to local media',
    async (quality) => {
      mocks.requestJson.mockResolvedValue({ quality });
      const local: FeaturedTrailer = { type: 'local', provider: 'jellyfin', itemId: 'local' };
      controller.start(slide, item([youtube('example1234'), local]));
      await vi.runAllTimersAsync();
      const options = mocks.createTrailerPlayer.mock.calls[0][1] as TrailerPlaybackOptions;
      options.onError(new Error('embedding blocked'));
      await vi.runAllTimersAsync();
      expect(mocks.createTrailerPlayer.mock.calls.map(([candidate]) => candidate.provider)).toEqual([
        'youtube',
        'jellyfin'
      ]);
      expect(mocks.requestJson).toHaveBeenCalledOnce();
    }
  );

  it.each(['stop', 'destroy', 'navigate', 'replace'])('ignores pending checks after %s', async (action) => {
    let resolve!: (value: { quality: string }) => void;
    mocks.requestJson.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const candidates = item([youtube('example1234')]);
    controller.start(slide, candidates);
    await vi.advanceTimersByTimeAsync(0);
    // Repeated start calls must share the pending check.
    controller.start(slide, candidates);
    expect(mocks.requestJson).toHaveBeenCalledOnce();
    if (action === 'navigate') activeIndex = 1;
    else if (action === 'destroy') controller.destroy();
    else if (action === 'replace')
      controller.start(slide, { ...item([{ type: 'local', provider: 'jellyfin' }]), id: 'other' });
    else controller.stop();
    resolve({ quality: 'hd' });
    await vi.runAllTimersAsync();
    expect(mocks.createTrailerPlayer.mock.calls.some(([candidate]) => candidate.provider === 'youtube')).toBe(false);
    expect(restartAutoplay).not.toHaveBeenCalled();
  });

  it('preserves legacy candidates without making a metadata request', async () => {
    controller.start(slide, item([{ ...youtube('example1234'), youTubeQualityFilterEnabled: undefined }]));
    await vi.runAllTimersAsync();
    expect(mocks.createTrailerPlayer).toHaveBeenCalledOnce();
    expect(mocks.requestJson).not.toHaveBeenCalled();
  });

  it('can retry the same slide after a pending check finishes while the document is hidden', async () => {
    let resolve!: (value: { quality: string }) => void;
    mocks.requestJson.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const candidates = item([youtube('example1234')]);
    controller.start(slide, candidates);
    await vi.advanceTimersByTimeAsync(0);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    resolve({ quality: 'hd' });
    await vi.runAllTimersAsync();
    expect(mocks.createTrailerPlayer).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    mocks.requestJson.mockResolvedValue({ quality: 'hd' });
    controller.start(slide, candidates);
    await vi.runAllTimersAsync();
    expect(mocks.createTrailerPlayer).toHaveBeenCalledOnce();
  });
});
