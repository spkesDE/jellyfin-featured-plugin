import type {
  FeaturedPluginConfig,
  FeaturedPresetLayoutSettings,
  FeaturedPresetTrailerSettings,
  HeroFadeCurve,
  HeroFadePoint,
  TrailerSourcePriority
} from '../../types/config';

type HeroLayoutSettings = Pick<
  FeaturedPluginConfig | FeaturedPresetLayoutSettings,
  | 'HeroFadeStart'
  | 'HeroFadeEnd'
  | 'HeroFadeCurve'
  | 'HeroFadePoints'
  | 'HeroHeightMode'
  | 'BannerNavigationPosition'
  | 'BannerMediaControlsPosition'
>;

type TrailerSettings = Pick<FeaturedPluginConfig | FeaturedPresetTrailerSettings, 'TrailerSourcePriority'>;
export type LegacyTrailerFallback = { FallBackToRemoteTrailers?: boolean };

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
