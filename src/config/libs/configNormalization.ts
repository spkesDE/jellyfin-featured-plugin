import type {
  FeaturedMediaPriorityEntry,
  FeaturedPluginConfig,
  FeaturedPresetLayoutSettings,
  FeaturedPresetTrailerSettings,
  HeroFadeCurve,
  HeroFadePoint,
  MediaPriorityType,
  TrailerSourcePriority
} from '../../types/config';

type HeroLayoutSettings = Pick<
  FeaturedPluginConfig | FeaturedPresetLayoutSettings,
  | 'HeroFadeStart'
  | 'HeroFadeEnd'
  | 'HeroFadeCurve'
  | 'HeroFadePoints'
  | 'HeroHeightMode'
  | 'HeroTextPosition'
  | 'HeroTextVerticalPosition'
  | 'BannerNavigationPosition'
  | 'BannerMediaControlsPosition'
>;

type TrailerSettings = Pick<FeaturedPluginConfig | FeaturedPresetTrailerSettings, 'TrailerSourcePriority'>;
type MediaExcerptSettings = Pick<
  FeaturedPluginConfig | FeaturedPresetTrailerSettings,
  'MediaExcerptWindowStartMinutes' | 'MediaExcerptWindowEndMinutes' | 'MediaExcerptDurationSeconds'
>;
export type LegacyTrailerFallback = { FallBackToRemoteTrailers?: boolean };
export type LegacySourceMediaFallback = { UseTrickplayFallback?: boolean; UseMediaPreviewFallback?: boolean };

/** Normalizes the duplicated root/preset layout boundary through one compatibility path. */
export function normalizeHeroLayoutSettings(settings: HeroLayoutSettings): void {
  const fade = normalizeHeroFade(
    settings.HeroFadeStart,
    settings.HeroFadeEnd,
    settings.HeroFadeCurve,
    settings.HeroFadePoints
  );
  settings.HeroFadeStart = fade.start;
  settings.HeroFadeEnd = fade.end;
  settings.HeroFadeCurve = fade.curve;
  settings.HeroFadePoints = fade.points;
  settings.HeroHeightMode = ['auto', 'compact', 'standard', 'cinematic', 'fullscreen', 'custom'].includes(
    String(settings.HeroHeightMode)
  )
    ? settings.HeroHeightMode
    : 'standard';
  settings.HeroTextPosition = ['left', 'center', 'right'].includes(settings.HeroTextPosition)
    ? settings.HeroTextPosition
    : 'left';
  settings.HeroTextVerticalPosition = ['top', 'center', 'bottom'].includes(settings.HeroTextVerticalPosition)
    ? settings.HeroTextVerticalPosition
    : 'top';
  settings.BannerNavigationPosition = ['bottom-center', 'top-right', 'center'].includes(
    settings.BannerNavigationPosition
  )
    ? settings.BannerNavigationPosition
    : 'bottom-center';
  settings.BannerMediaControlsPosition = ['bottom-center', 'top-right', 'center'].includes(
    settings.BannerMediaControlsPosition
  )
    ? settings.BannerMediaControlsPosition
    : 'top-right';
}

/** Keeps the pre-12.x boolean trailer fallback readable at the persisted-config boundary. */
export function normalizeTrailerSourcePriority(
  settings: TrailerSettings,
  legacy: LegacyTrailerFallback | undefined
): TrailerSourcePriority {
  if (settings.TrailerSourcePriority === 'prefer_local' && legacy?.FallBackToRemoteTrailers === false) {
    return 'local_only';
  }
  return settings.TrailerSourcePriority;
}

export const MEDIA_PRIORITY_TYPES: readonly MediaPriorityType[] = [
  'local_trailer',
  'remote_trailer',
  'media_excerpt',
  'trickplay'
];

const TRAILER_SOURCE_ORDER: Record<TrailerSourcePriority, readonly [MediaPriorityType, boolean][]> = {
  prefer_local: [
    ['local_trailer', true],
    ['remote_trailer', true]
  ],
  automatic: [
    ['local_trailer', true],
    ['remote_trailer', true]
  ],
  prefer_remote: [
    ['remote_trailer', true],
    ['local_trailer', true]
  ],
  local_only: [
    ['local_trailer', true],
    ['remote_trailer', false]
  ],
  remote_only: [
    ['remote_trailer', true],
    ['local_trailer', false]
  ],
  local_remote_excerpt: [
    ['local_trailer', true],
    ['remote_trailer', true],
    ['media_excerpt', true]
  ],
  local_excerpt_remote: [
    ['local_trailer', true],
    ['media_excerpt', true],
    ['remote_trailer', true]
  ],
  excerpt_only: [
    ['media_excerpt', true],
    ['local_trailer', false],
    ['remote_trailer', false]
  ]
};

/**
 * Mirrors the backend mapping from a trailer source priority to a source's media priority list. New sources start
 * from it, and sources saved before the list existed migrate through it together with their fallback flags.
 */
export function mediaPriorityFromTrailerSource(
  priority: TrailerSourcePriority,
  legacy: LegacySourceMediaFallback = {}
): FeaturedMediaPriorityEntry[] {
  const entries: FeaturedMediaPriorityEntry[] = (
    TRAILER_SOURCE_ORDER[priority] ?? TRAILER_SOURCE_ORDER.prefer_local
  ).map(([Type, Enabled]) => ({
    Type,
    Enabled: Enabled || (Type === 'media_excerpt' && legacy.UseMediaPreviewFallback === true)
  }));
  if (!entries.some((entry) => entry.Type === 'media_excerpt')) {
    entries.push({ Type: 'media_excerpt', Enabled: legacy.UseMediaPreviewFallback === true });
  }
  entries.push({ Type: 'trickplay', Enabled: legacy.UseTrickplayFallback === true });
  return entries;
}

/** Keeps each known type once in its saved order and appends missing types disabled, like the backend. */
export function normalizeMediaPriority(value: unknown): FeaturedMediaPriorityEntry[] {
  const entries: FeaturedMediaPriorityEntry[] = [];
  for (const candidate of Array.isArray(value) ? value : []) {
    const type = MEDIA_PRIORITY_TYPES.find(
      (known) => known === String((candidate as Partial<FeaturedMediaPriorityEntry>)?.Type ?? '').toLowerCase()
    );
    if (type && !entries.some((entry) => entry.Type === type)) {
      entries.push({ Type: type, Enabled: (candidate as FeaturedMediaPriorityEntry).Enabled === true });
    }
  }
  for (const type of MEDIA_PRIORITY_TYPES) {
    if (!entries.some((entry) => entry.Type === type)) entries.push({ Type: type, Enabled: false });
  }
  return entries;
}

/** Resolves a persisted source's media priority, migrating the pre-list fallback flags of its scope. */
export function normalizeSourceMediaPriority(
  rule: { MediaPriority?: unknown } & LegacySourceMediaFallback,
  trailerSourcePriority: TrailerSourcePriority
): FeaturedMediaPriorityEntry[] {
  if (rule.UseTrickplayFallback !== undefined || rule.UseMediaPreviewFallback !== undefined) {
    return mediaPriorityFromTrailerSource(trailerSourcePriority, rule);
  }
  return normalizeMediaPriority(rule.MediaPriority);
}

/** Mirrors the backend excerpt bounds so the editor never shows values the server would rewrite. */
export function normalizeMediaExcerptSettings(settings: MediaExcerptSettings): void {
  const start = clampInteger(settings.MediaExcerptWindowStartMinutes, 0, 600, 5);
  settings.MediaExcerptWindowStartMinutes = start;
  settings.MediaExcerptWindowEndMinutes = clampInteger(
    settings.MediaExcerptWindowEndMinutes,
    start,
    600,
    Math.max(start, 15)
  );
  settings.MediaExcerptDurationSeconds = clampInteger(settings.MediaExcerptDurationSeconds, 10, 120, 30);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeHeroFade(
  startValue: unknown,
  endValue: unknown,
  curveValue: unknown,
  pointsValue: unknown
): {
  start: number;
  end: number;
  curve: HeroFadeCurve;
  points: HeroFadePoint[];
} {
  const startNumber = typeof startValue === 'number' && Number.isFinite(startValue) ? startValue : 50;
  const endNumber = typeof endValue === 'number' && Number.isFinite(endValue) ? endValue : 100;
  const start = Math.max(0, Math.min(100, startNumber));
  const end = Math.max(0, Math.min(100, endNumber));
  const curve = normalizeHeroFadeCurve(curveValue);
  const points = normalizeHeroFadePoints(pointsValue);
  if (end <= start) return { start: 50, end: 100, curve, points };
  return { start, end, curve, points };
}

function normalizeHeroFadeCurve(_value: unknown): HeroFadeCurve {
  // Named fade presets were removed; the editable point list is now the single source of truth.
  return 'custom';
}

function normalizeHeroFadePoints(value: unknown): HeroFadePoint[] {
  const interior = Array.isArray(value)
    ? value
        .map((point) => (point && typeof point === 'object' ? (point as Partial<HeroFadePoint>) : {}))
        .filter(
          (point) =>
            Number.isFinite(Number(point.Position)) && Number(point.Position) > 0 && Number(point.Position) < 100
        )
        .map((point) => ({
          Position: Math.round(Math.max(1, Math.min(99, Number(point.Position) || 0))),
          Fade: Math.round(Math.max(0, Math.min(100, Number(point.Fade) || 0)))
        }))
        .sort((left, right) => left.Position - right.Position)
        .filter((point, index, points) => index === 0 || point.Position !== points[index - 1].Position)
        .slice(0, 10)
    : [];
  return [{ Position: 0, Fade: 0 }, ...interior, { Position: 100, Fade: 100 }];
}
