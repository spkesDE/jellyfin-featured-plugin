export const TRAILER_VOLUME_STORAGE_KEY = 'jellyfin-featured.trailer-volume';
export const DEFAULT_TRAILER_VOLUME = 100;
const STANDARD_VERTICAL_RANGE_CHROMIUM_VERSION = 124;

/** Chromium only standardized vertical range controls after the webOS 6 engine. */
export function requiresLegacyVerticalRangeAppearance(userAgent: string = navigator.userAgent): boolean {
  const chromiumVersion = /(?:Chrome|Chromium)\/(\d+)/.exec(userAgent)?.[1];
  return chromiumVersion !== undefined && Number(chromiumVersion) < STANDARD_VERTICAL_RANGE_CHROMIUM_VERSION;
}

export function clampTrailerVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : DEFAULT_TRAILER_VOLUME;
}

export function readTrailerVolume(storage: Pick<Storage, 'getItem'> = window.localStorage): number {
  try {
    const stored = storage.getItem(TRAILER_VOLUME_STORAGE_KEY);
    return stored === null ? DEFAULT_TRAILER_VOLUME : clampTrailerVolume(Number(stored));
  } catch {
    return DEFAULT_TRAILER_VOLUME;
  }
}

export function saveTrailerVolume(volume: number, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    storage.setItem(TRAILER_VOLUME_STORAGE_KEY, String(clampTrailerVolume(volume)));
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}
