import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrailerPlaybackOptions, TrailerPlayer } from '../../src/slider/trailerTypes';
import type { FeaturedItem, FeaturedResponse } from '../../src/types/featured';

const trailerMocks = vi.hoisted(() => ({
  createTrailerPlayer: vi.fn(),
  isMobileTrailerClient: vi.fn(() => false)
}));
vi.mock('../../src/slider/trailer', () => trailerMocks);

import { TrailerController } from '../../src/slider/trailerController';

describe('TrailerController fallback', () => {
  afterEach(() => vi.useRealTimers());

  it('advances to the next candidate when playback fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = createPlayer('first-player', () => Promise.reject(new Error('first provider failed')));
    const second = createPlayer('second-player', () => Promise.resolve());
    const options: TrailerPlaybackOptions[] = [];
    trailerMocks.createTrailerPlayer
      .mockReset()
      .mockImplementationOnce((_trailer, playbackOptions: TrailerPlaybackOptions) => {
        options.push(playbackOptions);
        return first;
      })
      .mockImplementationOnce((_trailer, playbackOptions: TrailerPlaybackOptions) => {
        options.push(playbackOptions);
        return second;
      });
    const restartAutoplay = vi.fn();
    const controller = new TrailerController(createResponse(), true, null, null, {
      getActiveIndex: () => 0,
      isDestroyed: () => false,
      isAutoplayEnabled: () => true,
      advance: vi.fn(),
      pauseAutoplay: vi.fn(),
      restartAutoplay
    });
    const slide = document.createElement('article');
    const media = document.createElement('div');
    media.className = 'featured-media';
    const backdrop = document.createElement('div');
    backdrop.className = 'featured-backdrop';
    media.appendChild(backdrop);
    slide.appendChild(media);

    controller.start(slide, createItem());
    await vi.runAllTimersAsync();

    expect(trailerMocks.createTrailerPlayer).toHaveBeenCalledTimes(2);
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(slide.querySelector('.second-player')).toBe(second.element);
    expect(restartAutoplay).not.toHaveBeenCalled();
    expect(options).toHaveLength(2);
    controller.destroy();
  });
});

function createPlayer(className: string, play: () => Promise<void>): TrailerPlayer {
  const element = document.createElement('div');
  element.className = className;
  return {
    element,
    play: vi.fn(play),
    pause: vi.fn(() => Promise.resolve()),
    setMuted: vi.fn(() => Promise.resolve()),
    setVolume: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(() => element.remove())
  };
}

function createResponse(): FeaturedResponse {
  return {
    enableBackgroundTrailers: true,
    allowTrailersOnMobile: true,
    hideYouTubeTrailerUntilControlsFade: false,
    trailerDelayMilliseconds: 0,
    trailerStartOffsetSeconds: 0,
    trailerEndOffsetSeconds: 0,
    waitForTrailerToFinish: false,
    startTrailersMuted: true,
    trailerVolumeSliderDirection: 'down',
    showTrailerControls: false
  } as FeaturedResponse;
}

function createItem(): FeaturedItem {
  return {
    id: 'item',
    name: 'Item',
    hasLogo: false,
    hasImage: true,
    isFavorite: false,
    isPlayed: false,
    imageType: 'Backdrop',
    mediaType: 'Movie',
    trailers: [
      { type: 'remote', provider: 'direct', url: 'https://example.test/first.mp4' },
      { type: 'remote', provider: 'direct', url: 'https://example.test/second.mp4' }
    ]
  };
}
