import { describe, expect, it } from 'vitest';
import { applyHeroLayoutVariables, getHeroHeightCssValue } from '../../src/slider/layout';
import type { HeroLayoutSettings } from '../../src/slider/layout';

const settings: HeroLayoutSettings = {
  heroHeightMode: 'cinematic',
  bannerHeight: 640,
  tabletBannerHeight: 500,
  mobileBannerHeight: 350,
  heroBorderRadius: 0,
  heroGradientStrength: 85,
  heroFadeStart: 40,
  heroFadeEnd: 90,
  heroFadeCurve: 'custom',
  heroFadePoints: [],
  mediaPadding: 0,
  useHeroLayout: true
};

describe('hero height variables', () => {
  it('keeps every desktop height mode inline on the root element', () => {
    expect(getHeroHeightCssValue('auto', 640)).toBe('clamp(360px, 46vw, 750px)');
    expect(getHeroHeightCssValue('compact', 640)).toBe('360px');
    expect(getHeroHeightCssValue('standard', 640)).toBe('500px');
    expect(getHeroHeightCssValue('cinematic', 640)).toBe('750px');
    expect(getHeroHeightCssValue('fullscreen', 640)).toBe('100vh');
    expect(getHeroHeightCssValue('custom', 640)).toBe('640px');

    const root = document.createElement('section');
    applyHeroLayoutVariables(root, settings);

    expect(root.style.getPropertyValue('--ec-height')).toBe('750px');
    expect(root.style.getPropertyValue('--ec-tablet-height')).toBe('500px');
    expect(root.style.getPropertyValue('--ec-mobile-height')).toBe('350px');
    expect(root.style.getPropertyValue('--ec-hero-overlap')).toBe('280px');
  });
});
