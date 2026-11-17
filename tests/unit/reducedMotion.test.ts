import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeaturedResponseDefaults } from '../../src/config/libs/configProjection';
import { FeaturedCarousel } from '../../src/slider/carousel';
import { TrailerController } from '../../src/slider/trailerController';
import type { FeaturedItem, FeaturedResponse } from '../../src/types/featured';

vi.mock('../../src/slider/trailerAudioPreference', () => ({ rememberTrailerAudio: vi.fn() }));

function preferReducedMotion(reduce: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }) as unknown as MediaQueryList
  );
}

function createItem(id: string): FeaturedItem {
  return { id, name: id, mediaType: 'Movie', imageType: 'Backdrop', hasImage: true, hasLogo: false } as FeaturedItem;
}

function createResponse(): FeaturedResponse {
  return {
    ...createFeaturedResponseDefaults(),
    items: [createItem('one'), createItem('two')],
    autoplay: true,
    autoplayInterval: 1000,
    showAutoplayButton: true,
    enableBackgroundTrailers: true,
    trailerDelayMilliseconds: 0,
    showPlayButton: false,
    showFavoriteButton: false,
    showPlaystateButton: false,
    showDismissalButton: false,
    useHeroLayout: false
  };
}

describe('reduced motion', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the slides still until the viewer starts autoplay', () => {
    vi.useFakeTimers();
    preferReducedMotion(true);
    const carousel = new FeaturedCarousel(createResponse());
    document.body.appendChild(carousel.root);

    vi.advanceTimersByTime(3000);
    expect(carousel.getActiveItem()?.id).toBe('one');

    carousel.root.querySelector<HTMLButtonElement>('.featured-autoplay')?.click();
    vi.advanceTimersByTime(1000);
    expect(carousel.getActiveItem()?.id).toBe('two');
    carousel.destroy();
  });

  it('still rotates automatically without the preference', () => {
    vi.useFakeTimers();
    preferReducedMotion(false);
    const carousel = new FeaturedCarousel(createResponse());
    document.body.appendChild(carousel.root);

    vi.advanceTimersByTime(1000);
    expect(carousel.getActiveItem()?.id).toBe('two');
    carousel.destroy();
  });

  it('does not start background video', () => {
    vi.useFakeTimers();
    preferReducedMotion(true);
    const controller = new TrailerController(createResponse(), true, null, null, {
      getActiveIndex: () => 0,
      isDestroyed: () => false,
      isAutoplayEnabled: () => false,
      advance: vi.fn(),
      pauseAutoplay: vi.fn(),
      restartAutoplay: vi.fn()
    });
    const item = {
      ...createItem('one'),
      trailer: { type: 'remote', provider: 'youtube', videoId: 'x' }
    } as FeaturedItem;

    controller.start(document.createElement('div'), item);
    vi.advanceTimersByTime(1000);

    expect((controller as unknown as { delayTimer: number | null }).delayTimer).toBeNull();
    expect((controller as unknown as { player: unknown }).player).toBeNull();
    controller.destroy();
  });
});
