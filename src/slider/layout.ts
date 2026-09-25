import type { HeroFadeCurve, HeroFadePoint, HeroHeightMode } from '../types/config';
import type { HeroFadeDisplayPoint } from '../types/display';

type HeroFadePointInput = HeroFadePoint | HeroFadeDisplayPoint;

export interface HeroLayoutSettings {
  heroHeightMode: HeroHeightMode;
  bannerHeight: number;
  tabletBannerHeight: number;
  mobileBannerHeight: number;
  heroBorderRadius: number;
  heroGradientStrength: number;
  heroFadeStart: number;
  heroFadeEnd: number;
  heroFadeCurve: HeroFadeCurve;
  heroFadePoints: HeroFadePointInput[];
  mediaPadding: number;
  useHeroLayout: boolean;
}

export function getHeroDesktopHeight(mode: HeroHeightMode, customHeight: number): number {
  if (mode === 'compact') return 360;
  if (mode === 'standard') return 500;
  if (mode === 'cinematic') return 750;
  if (mode === 'fullscreen') return 900;
  if (mode === 'custom') return customHeight;
  return 500;
}

const HERO_FADE_PRESETS: Record<Exclude<HeroFadeCurve, 'custom'>, HeroFadePoint[]> = {
  soft: [
    { Position: 0, Fade: 0 }, { Position: 16, Fade: 18 }, { Position: 30, Fade: 38 },
    { Position: 50, Fade: 60 }, { Position: 70, Fade: 80 }, { Position: 92, Fade: 94 },
    { Position: 100, Fade: 100 }
  ],
  balanced: [
    { Position: 0, Fade: 0 }, { Position: 16, Fade: 8 }, { Position: 30, Fade: 28 },
    { Position: 50, Fade: 52 }, { Position: 70, Fade: 76 }, { Position: 92, Fade: 92 },
    { Position: 100, Fade: 100 }
  ],
  strong: [
    { Position: 0, Fade: 0 }, { Position: 16, Fade: 2 }, { Position: 30, Fade: 12 },
    { Position: 50, Fade: 32 }, { Position: 70, Fade: 60 }, { Position: 92, Fade: 86 },
    { Position: 100, Fade: 100 }
  ]
};

function pointPosition(point: HeroFadePointInput): number {
  return 'Position' in point ? point.Position : point.position;
}

function pointFade(point: HeroFadePointInput): number {
  return 'Fade' in point ? point.Fade : point.fade;
}

export function getHeroFadePoints(curve: HeroFadeCurve, customPoints: HeroFadePointInput[] = []): HeroFadePoint[] {
  if (curve !== 'custom') return HERO_FADE_PRESETS[curve].map((point) => ({ ...point }));
  const interior = customPoints
    .map((point) => ({ Position: pointPosition(point), Fade: pointFade(point) }))
    .filter((point) => Number.isFinite(point.Position) && Number.isFinite(point.Fade)
      && point.Position > 0 && point.Position < 100)
    .map((point) => ({
      Position: Math.round(Math.max(1, Math.min(99, point.Position))),
      Fade: Math.round(Math.max(0, Math.min(100, point.Fade)))
    }))
    .sort((left, right) => left.Position - right.Position)
    .filter((point, index, points) => index === 0 || point.Position !== points[index - 1].Position)
    .slice(0, 10);
  return [{ Position: 0, Fade: 0 }, ...interior, { Position: 100, Fade: 100 }];
}

export function createHeroFadeMask(
  start: number,
  end: number,
  curve: HeroFadeCurve,
  strength = 85,
  customPoints: HeroFadePointInput[] = []
): string {
  const safeStart = Number.isFinite(start) ? Math.max(0, Math.min(100, start)) : 40;
  const safeEnd = Number.isFinite(end) ? Math.max(0, Math.min(100, end)) : 90;
  const normalizedStrength = Number.isFinite(strength) ? Math.max(0, Math.min(100, strength)) / 100 : 0.85;
  if (normalizedStrength === 0) return 'none';
  const normalizedStart = safeEnd > safeStart ? safeStart : 40;
  const normalizedEnd = safeEnd > safeStart ? safeEnd : 90;
  const span = normalizedEnd - normalizedStart;
  const fadeOpacity = (fade: number): string => {
    const adjusted = Math.round((1 - ((fade / 100) * normalizedStrength)) * 1000) / 1000;
    return String(adjusted).replace(/^0(?=\.)/, '');
  };
  const stops = getHeroFadePoints(curve, customPoints).slice(1).map((point) => {
    const position = Math.round((normalizedStart + (span * point.Position / 100)) * 100) / 100;
    const opacity = fadeOpacity(point.Fade);
    return `rgba(0,0,0,${opacity}) ${position}%`;
  });
  return `linear-gradient(to bottom, #000 0%, #000 ${normalizedStart}%, ${stops.join(', ')})`;
}

export function getHeroOverlap(height: number, mode?: HeroHeightMode): number {
  // Hero layout adds 52px back in its margin formula. Matching that value
  // keeps fullscreen at a true viewport height without pulling sections up.
  if (mode === 'fullscreen') return 52;
  if (height <= 400) return 50;
  if (height <= 500) return 100;
  return 280;
}

/** Keep the next Jellyfin section below the visible content, not below all artwork. */
export function calculateHeroClearance(currentClearance: number, contentBottom: number, sectionTop: number, gap = 12): number {
  return Math.max(0, Math.ceil(currentClearance + contentBottom + gap - sectionTop));
}

export function applyHeroLayoutVariables(element: HTMLElement, settings: HeroLayoutSettings): void {
  if (settings.heroHeightMode === 'custom') {
    element.style.setProperty('--ec-height', `${settings.bannerHeight}px`);
  }
  element.style.setProperty('--ec-tablet-height', `${settings.tabletBannerHeight}px`);
  element.style.setProperty('--ec-mobile-height', `${settings.mobileBannerHeight}px`);
  element.style.setProperty(
    '--ec-hero-overlap',
    `${getHeroOverlap(getHeroDesktopHeight(settings.heroHeightMode, settings.bannerHeight), settings.heroHeightMode)}px`
  );
  element.style.setProperty('--ec-media-padding', `${settings.mediaPadding}px`);

  if (settings.useHeroLayout) {
    element.style.setProperty('--ec-gradient-strength', String(settings.heroGradientStrength / 100));
    element.style.setProperty('--ec-hero-media-mask', createHeroFadeMask(
      settings.heroFadeStart,
      settings.heroFadeEnd,
      settings.heroFadeCurve,
      settings.heroGradientStrength,
      settings.heroFadePoints
    ));
  } else {
    element.style.setProperty('--ec-radius', `${settings.heroBorderRadius}px`);
  }
}
