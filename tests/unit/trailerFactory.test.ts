import { describe, expect, it, vi } from 'vitest';
import { DirectVideoPlayer } from '../../src/slider/htmlVideoPlayer';
import { createTrailerPlayer } from '../../src/slider/trailerFactory';
import type { TrailerPlaybackOptions } from '../../src/slider/trailerTypes';

const options: TrailerPlaybackOptions = {
  muted: true,
  volume: 50,
  startOffsetSeconds: 0,
  endOffsetSeconds: 0,
  loop: false,
  onEnded: vi.fn(),
  onError: vi.fn()
};

describe('createTrailerPlayer', () => {
  it('selects the adapter from the resolved provider contract', () => {
    const direct = createTrailerPlayer(
      { type: 'remote', provider: 'direct', url: 'https://example.test/trailer.mp4' },
      options
    );
    expect(direct).toBeInstanceOf(DirectVideoPlayer);

    direct?.destroy();
  });

  it('rejects incomplete provider data', () => {
    expect(createTrailerPlayer({ type: 'remote', provider: 'youtube' }, options)).toBeNull();
    expect(createTrailerPlayer({ type: 'remote', provider: 'direct' }, options)).toBeNull();
  });
});
