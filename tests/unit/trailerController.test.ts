import { describe, expect, it, vi } from 'vitest';
import { TrailerController } from '../../src/slider/trailerController';
import type { FeaturedResponse } from '../../src/types/featured';

function createResponse(): FeaturedResponse {
  return {
    showTrailerControls: true,
    startTrailersMuted: true,
    trailerVolumeSliderDirection: 'down'
  } as FeaturedResponse;
}

describe('TrailerController', () => {
  it('builds accessible controls and owns its global listener teardown', () => {
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const controller = new TrailerController(createResponse(), true, null, null, {
      getActiveIndex: () => 0,
      isDestroyed: () => false,
      isAutoplayEnabled: () => true,
      advance: vi.fn(),
      pauseAutoplay: vi.fn(),
      restartAutoplay: vi.fn()
    });

    expect(controller.controls?.querySelector('.ec-trailer-pause')).toBeInstanceOf(HTMLButtonElement);
    expect(controller.controls?.querySelector('.ec-trailer-mute')).toBeInstanceOf(HTMLButtonElement);
    expect(controller.controls?.querySelector<HTMLInputElement>('.ec-trailer-volume')?.min).toBe('0');
    expect(controller.controls?.querySelector<HTMLInputElement>('.ec-trailer-volume')?.max).toBe('100');
    expect(controller.controls?.querySelector('.ec-volume-side')).toBeNull();

    controller.destroy();

    expect(addDocument).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removeDocument).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(addWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
