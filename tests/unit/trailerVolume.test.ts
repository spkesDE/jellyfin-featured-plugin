import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAILER_VOLUME,
  TRAILER_VOLUME_STORAGE_KEY,
  clampTrailerVolume,
  readTrailerVolume,
  requiresLegacyVerticalRangeAppearance,
  saveTrailerVolume
} from '../../src/slider/trailerVolume';

describe('trailer volume persistence', () => {
  it('clamps persisted and user-provided values', () => {
    expect(clampTrailerVolume(-10)).toBe(0);
    expect(clampTrailerVolume(42)).toBe(42);
    expect(clampTrailerVolume(140)).toBe(100);
    expect(clampTrailerVolume(Number.NaN)).toBe(DEFAULT_TRAILER_VOLUME);
  });

  it('survives unavailable browser storage', () => {
    const unavailable = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };

    expect(readTrailerVolume(unavailable)).toBe(DEFAULT_TRAILER_VOLUME);
    expect(() => saveTrailerVolume(50, unavailable)).not.toThrow();
  });

  it('uses the stable storage key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    saveTrailerVolume(75, storage);

    expect(values.get(TRAILER_VOLUME_STORAGE_KEY)).toBe('75');
    expect(readTrailerVolume(storage)).toBe(75);
  });

  it('uses the proprietary vertical slider only on legacy Chromium clients', () => {
    expect(requiresLegacyVerticalRangeAppearance('Mozilla/5.0 Chrome/79.0.3945.79 Safari/537.36')).toBe(true);
    expect(requiresLegacyVerticalRangeAppearance('Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36')).toBe(true);
    expect(requiresLegacyVerticalRangeAppearance('Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36')).toBe(false);
    expect(requiresLegacyVerticalRangeAppearance('Mozilla/5.0 Firefox/130.0')).toBe(false);
  });
});
