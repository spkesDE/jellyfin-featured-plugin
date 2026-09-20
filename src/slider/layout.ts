import type { HeroFadeCurve, HeroHeightMode } from '../types/config';

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

const FADE_STOP_OFFSETS = [0.16, 0.3, 0.5, 0.7, 0.92];
const FADE_CURVE_OPACITIES: Record<HeroFadeCurve, number[]> = {
  soft: [0.82, 0.62, 0.4, 0.2, 0.06],
  balanced: [0.92, 0.72, 0.48, 0.24, 0.08],
  strong: [0.98, 0.88, 0.68, 0.4, 0.14]
};

export function createHeroFadeMask(start: number, end: number, curve: HeroFadeCurve): string {
  const safeStart = Number.isFinite(start) ? Math.max(0, Math.min(100, start)) : 40;
  const safeEnd = Number.isFinite(end) ? Math.max(0, Math.min(100, end)) : 90;
  const normalizedStart = safeEnd > safeStart ? safeStart : 40;
  const normalizedEnd = safeEnd > safeStart ? safeEnd : 90;
  const span = normalizedEnd - normalizedStart;
  const opacities = FADE_CURVE_OPACITIES[curve] || FADE_CURVE_OPACITIES.balanced;
  const intermediate = FADE_STOP_OFFSETS.map((offset, index) => {
    const position = Math.round((normalizedStart + (span * offset)) * 100) / 100;
    const opacity = String(opacities[index]).replace(/^0/, '');
    return `rgba(0,0,0,${opacity}) ${position}%`;
  });
  return `linear-gradient(to bottom, #000 0%, #000 ${normalizedStart}%, ${intermediate.join(', ')}, transparent ${normalizedEnd}%)`;
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
      settings.heroFadeCurve
    ));
  } else {
    element.style.setProperty('--ec-radius', `${settings.heroBorderRadius}px`);
  }
}
