import { describe, expect, it, vi } from 'vitest';
import { rememberTrailerAudio } from '../../src/slider/trailerAudioPreference';
import { TrailerController } from '../../src/slider/trailerController';
import { DEFAULT_TRAILER_VOLUME, readTrailerVolume, saveTrailerVolume } from '../../src/slider/trailerVolume';
import type { FeaturedResponse } from '../../src/types/featured';

vi.mock('../../src/slider/trailerAudioPreference', () => ({ rememberTrailerAudio: vi.fn() }));

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

    expect(controller.controls?.querySelector('.featured-trailer-pause')).toBeInstanceOf(HTMLButtonElement);
    expect(controller.controls?.querySelector('.featured-trailer-mute')).toBeInstanceOf(HTMLButtonElement);
    expect(controller.controls?.querySelector<HTMLInputElement>('.featured-trailer-volume')?.min).toBe('0');
    expect(controller.controls?.querySelector<HTMLInputElement>('.featured-trailer-volume')?.max).toBe('100');
    expect(controller.controls?.querySelector('.featured-volume-side')).toBeNull();

    controller.destroy();

    expect(addDocument).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removeDocument).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(addWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('opens the volume slider upward from the bottom banner slot', () => {
    const response = createResponse();
    response.useHeroLayout = false;
    response.bannerMediaControlsPosition = 'bottom-center';
    const controller = new TrailerController(response, true, null, null, {
      getActiveIndex: () => 0,
      isDestroyed: () => false,
      isAutoplayEnabled: () => true,
      advance: vi.fn(),
      pauseAutoplay: vi.fn(),
      restartAutoplay: vi.fn()
    });

    expect(controller.controls?.querySelector('.featured-volume-up')).not.toBeNull();
    controller.destroy();
  });

  it('tolerates key events dispatched on document while a trailer player exists', () => {
    const controller = new TrailerController(createResponse(), true, null, null, {
      getActiveIndex: () => 0,
      isDestroyed: () => false,
      isAutoplayEnabled: () => true,
      advance: vi.fn(),
      pauseAutoplay: vi.fn(),
      restartAutoplay: vi.fn()
    });
    const internals = controller as unknown as { player: object; onHotkey: (event: KeyboardEvent) => void };
    internals.player = {};
    const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
    Object.defineProperty(event, 'target', { value: document });

    expect(() => internals.onHotkey(event)).not.toThrow();

    internals.player = null as unknown as object;
    controller.destroy();
  });

  it('starts from the profile volume and remembers mute and volume changes', () => {
    vi.mocked(rememberTrailerAudio).mockClear();
    const controller = new TrailerController(
      { ...createResponse(), rememberTrailerAudio: true, trailerVolume: 60 },
      true,
      null,
      null,
      {
        getActiveIndex: () => 0,
        isDestroyed: () => false,
        isAutoplayEnabled: () => true,
        advance: vi.fn(),
        pauseAutoplay: vi.fn(),
        restartAutoplay: vi.fn()
      }
    );
    const internals = controller as unknown as {
      player: { setMuted: () => Promise<void>; setVolume: () => Promise<void>; destroy: () => void } | null;
      volume: number;
      toggleMuted: () => void;
      setVolume: (volume: number) => void;
    };
    internals.player = { setMuted: async () => {}, setVolume: async () => {}, destroy: () => {} };
    expect(internals.volume).toBe(60);

    internals.toggleMuted();
    expect(rememberTrailerAudio).toHaveBeenLastCalledWith({ muted: false }, { persist: true });
    internals.setVolume(40);
    expect(rememberTrailerAudio).toHaveBeenLastCalledWith({ volume: 40 }, { persist: true });
    internals.setVolume(0);
    expect(rememberTrailerAudio).toHaveBeenLastCalledWith({ volume: 0, muted: true }, { persist: true });
    internals.toggleMuted();
    expect(rememberTrailerAudio).toHaveBeenLastCalledWith({ muted: false, volume: 10 }, { persist: true });

    internals.player = null;
    controller.destroy();
  });

  it('keeps the browser volume and remembers nothing when the admin disallows it', () => {
    vi.mocked(rememberTrailerAudio).mockClear();
    saveTrailerVolume(30);
    const controller = new TrailerController(
      { ...createResponse(), rememberTrailerAudio: false, trailerVolume: 60 },
      true,
      null,
      null,
      {
        getActiveIndex: () => 0,
        isDestroyed: () => false,
        isAutoplayEnabled: () => true,
        advance: vi.fn(),
        pauseAutoplay: vi.fn(),
        restartAutoplay: vi.fn()
      }
    );
    const internals = controller as unknown as {
      player: { setMuted: () => Promise<void>; setVolume: () => Promise<void>; destroy: () => void } | null;
      volume: number;
      toggleMuted: () => void;
      setVolume: (volume: number) => void;
    };
    internals.player = { setMuted: async () => {}, setVolume: async () => {}, destroy: () => {} };
    expect(internals.volume).toBe(30);

    internals.toggleMuted();
    internals.setVolume(50);
    expect(rememberTrailerAudio).not.toHaveBeenCalled();

    internals.player = null;
    controller.destroy();
  });

  it('keeps changes for the session only and starts from the user defaults when auto-save is off', () => {
    vi.mocked(rememberTrailerAudio).mockClear();
    saveTrailerVolume(30);
    const controller = new TrailerController(
      { ...createResponse(), rememberTrailerAudio: true, autoSaveTrailerAudio: false },
      true,
      null,
      null,
      {
        getActiveIndex: () => 0,
        isDestroyed: () => false,
        isAutoplayEnabled: () => true,
        advance: vi.fn(),
        pauseAutoplay: vi.fn(),
        restartAutoplay: vi.fn()
      }
    );
    const internals = controller as unknown as {
      player: { setMuted: () => Promise<void>; setVolume: () => Promise<void>; destroy: () => void } | null;
      volume: number;
      setVolume: (volume: number) => void;
    };
    internals.player = { setMuted: async () => {}, setVolume: async () => {}, destroy: () => {} };
    // Not the browser's last volume: after a reload the user's own default applies again.
    expect(internals.volume).toBe(DEFAULT_TRAILER_VOLUME);

    internals.setVolume(50);
    expect(rememberTrailerAudio).toHaveBeenLastCalledWith({ volume: 50, muted: false }, { persist: false });
    expect(readTrailerVolume()).toBe(30);

    internals.player = null;
    controller.destroy();
  });
});
