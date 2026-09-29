import { describe, expect, it, vi } from 'vitest';
import { createFeaturedResponseDefaults } from '../../src/config/libs/configProjection';
import { FeaturedCarousel } from '../../src/slider/carousel';
import type { FeaturedItem, FeaturedResponse } from '../../src/types/featured';

describe('FeaturedCarousel behaviour', () => {
  it('navigates with controls and horizontal swipes while ignoring vertical gestures', () => {
    const carousel = new FeaturedCarousel(createResponse([createItem('one'), createItem('two')]));
    document.body.appendChild(carousel.root);
    expect(carousel.getActiveItem()?.id).toBe('one');

    carousel.root.querySelector<HTMLButtonElement>('.featured-arrow-next')?.click();
    expect(carousel.getActiveItem()?.id).toBe('two');

    dispatchTouch(carousel.root, 'touchstart', 100, 100);
    dispatchTouch(carousel.root, 'touchend', 90, 180);
    expect(carousel.getActiveItem()?.id).toBe('two');

    dispatchTouch(carousel.root, 'touchstart', 100, 100);
    dispatchTouch(carousel.root, 'touchend', 180, 105);
    expect(carousel.getActiveItem()?.id).toBe('one');
    carousel.destroy();
  });

  it('loads the next batch at the navigation boundary and activates the pending item', async () => {
    const response = createResponse([createItem('one'), createItem('two')]);
    response.infiniteLoading = true;
    response.hasMore = true;
    response.batchSize = 1;
    const loadItems = vi.fn().mockResolvedValue({
      ...response,
      items: [createItem('three')],
      hasMore: false
    });
    const carousel = new FeaturedCarousel(response, loadItems);
    document.body.appendChild(carousel.root);

    carousel.root.querySelector<HTMLButtonElement>('.featured-arrow-next')?.click();
    await vi.waitFor(() => expect(loadItems).toHaveBeenCalledWith(['one', 'two']));
    carousel.root.querySelector<HTMLButtonElement>('.featured-arrow-next')?.click();
    await vi.waitFor(() => expect(carousel.getActiveItem()?.id).toBe('three'));
    carousel.destroy();
  });
});

function createResponse(items: FeaturedItem[]): FeaturedResponse {
  return {
    ...createFeaturedResponseDefaults(),
    items,
    autoplay: false,
    enableBackgroundTrailers: false,
    showPlayButton: false,
    showFavoriteButton: false,
    showPlaystateButton: false,
    showDismissalButton: false,
    useHeroLayout: false
  };
}

function createItem(id: string): FeaturedItem {
  return {
    id,
    name: id,
    hasLogo: false,
    hasImage: false,
    isFavorite: false,
    isPlayed: false,
    imageType: 'Backdrop',
    mediaType: 'Movie'
  };
}

function dispatchTouch(target: HTMLElement, type: 'touchstart' | 'touchend', clientX: number, clientY: number): void {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'changedTouches', { value: [{ clientX, clientY }] });
  target.dispatchEvent(event);
}
