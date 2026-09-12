import type { HeroHeightMode } from '../types/config';

export interface HeroLayoutSettings {
  heroHeightMode: HeroHeightMode;
  bannerHeight: number;
  tabletBannerHeight: number;
  mobileBannerHeight: number;
  heroBorderRadius: number;
  heroGradientStrength: number;
  mediaPadding: number;
  useHeroLayout: boolean;
}

export function getHeroDesktopHeight(mode: HeroHeightMode, customHeight: number): number {
  if (mode === 'compact') return 360;
  if (mode === 'standard') return 500;
  if (mode === 'cinematic') return 750;
  if (mode === 'custom') return customHeight;
  return 500;
}

export function getHeroOverlap(height: number): number {
  if (height <= 400) return 50;
  if (height <= 500) return 100;
  return 280;
}

export function applyHeroLayoutVariables(element: HTMLElement, settings: HeroLayoutSettings): void {
  if (settings.heroHeightMode === 'custom') {
    element.style.setProperty('--ec-height', `${settings.bannerHeight}px`);
  }
  element.style.setProperty('--ec-tablet-height', `${settings.tabletBannerHeight}px`);
  element.style.setProperty('--ec-mobile-height', `${settings.mobileBannerHeight}px`);
  element.style.setProperty(
    '--ec-hero-overlap',
    `${getHeroOverlap(getHeroDesktopHeight(settings.heroHeightMode, settings.bannerHeight))}px`
  );
  element.style.setProperty('--ec-media-padding', `${settings.mediaPadding}px`);

  if (settings.useHeroLayout) {
    element.style.setProperty('--ec-gradient-strength', String(settings.heroGradientStrength / 100));
  } else {
    element.style.setProperty('--ec-radius', `${settings.heroBorderRadius}px`);
  }
}
