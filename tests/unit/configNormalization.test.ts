import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../src/config/libs/configDefaults';
import { createPresetFromConfig } from '../../src/config/libs/configFactories';
import {
  normalizeHeroLayoutSettings,
  normalizeMediaExcerptSettings,
  normalizeTrailerSourcePriority,
  trailerSourceIncludesExcerpt
} from '../../src/config/libs/configNormalization';
import { normalizeConfig } from '../../src/config/libs/defaults';

describe('configuration normalization boundaries', () => {
  it('normalizes root and preset hero layouts through the same rules', () => {
    const root = createDefaultConfig();
    const preset = createPresetFromConfig(root).Layout;
    for (const target of [root, preset]) {
      target.HeroFadeStart = 90;
      target.HeroFadeEnd = 10;
      target.HeroFadeCurve = 'soft';
      target.HeroHeightMode = 'invalid' as typeof target.HeroHeightMode;
      target.BannerNavigationPosition = 'invalid' as typeof target.BannerNavigationPosition;
      target.BannerMediaControlsPosition = 'bottom-center';
      target.HeroFadePoints = [
        { Position: 20, Fade: 30 },
        { Position: 20, Fade: 80 }
      ];
      normalizeHeroLayoutSettings(target);
      expect(target.HeroFadeStart).toBe(50);
      expect(target.HeroFadeEnd).toBe(100);
      expect(target.HeroFadeCurve).toBe('custom');
      expect(target.HeroHeightMode).toBe('standard');
      expect(target.BannerNavigationPosition).toBe('bottom-center');
      expect(target.BannerMediaControlsPosition).toBe('bottom-center');
      expect(target.HeroFadePoints).toEqual([
        { Position: 0, Fade: 0 },
        { Position: 20, Fade: 30 },
        { Position: 100, Fade: 100 }
      ]);
    }
  });

  it('keeps valid text anchors and resets unknown ones to the top-left default', () => {
    const root = createDefaultConfig();
    const preset = createPresetFromConfig(root).Layout;
    expect(root.HeroTextVerticalPosition).toBe('top');
    expect(preset.HeroTextVerticalPosition).toBe('top');

    root.HeroTextPosition = 'right';
    root.HeroTextVerticalPosition = 'bottom';
    preset.HeroTextPosition = 'middle' as typeof preset.HeroTextPosition;
    preset.HeroTextVerticalPosition = 'middle' as typeof preset.HeroTextVerticalPosition;
    normalizeHeroLayoutSettings(root);
    normalizeHeroLayoutSettings(preset);

    expect([root.HeroTextPosition, root.HeroTextVerticalPosition]).toEqual(['right', 'bottom']);
    expect([preset.HeroTextPosition, preset.HeroTextVerticalPosition]).toEqual(['left', 'top']);
  });

  it('maps the legacy trailer fallback flag consistently', () => {
    expect(
      normalizeTrailerSourcePriority({ TrailerSourcePriority: 'prefer_local' }, { FallBackToRemoteTrailers: false })
    ).toBe('local_only');
    expect(
      normalizeTrailerSourcePriority({ TrailerSourcePriority: 'remote_only' }, { FallBackToRemoteTrailers: false })
    ).toBe('remote_only');
  });

  it('keeps excerpts out of the default trailer source and clamps root and preset excerpt settings', () => {
    const defaults = createDefaultConfig();
    expect(trailerSourceIncludesExcerpt(defaults.TrailerSourcePriority)).toBe(false);
    expect(trailerSourceIncludesExcerpt(createPresetFromConfig(defaults).Trailers.TrailerSourcePriority)).toBe(false);
    expect(
      (['local_remote_excerpt', 'local_excerpt_remote', 'excerpt_only', 'automatic'] as const).map(
        trailerSourceIncludesExcerpt
      )
    ).toEqual([true, true, true, false]);

    const root = createDefaultConfig();
    const preset = createPresetFromConfig(root).Trailers;
    for (const target of [root, preset]) {
      target.MediaExcerptWindowStartMinutes = 20.4;
      target.MediaExcerptWindowEndMinutes = 10;
      target.MediaExcerptDurationSeconds = 900;
      normalizeMediaExcerptSettings(target);
      expect(target.MediaExcerptWindowStartMinutes).toBe(20);
      expect(target.MediaExcerptWindowEndMinutes).toBe(20);
      expect(target.MediaExcerptDurationSeconds).toBe(120);
    }
  });

  it('fills excerpt settings missing from configurations saved before the feature existed', () => {
    const legacy = createDefaultConfig() as Partial<ReturnType<typeof createDefaultConfig>>;
    delete legacy.MediaExcerptDurationSeconds;
    const preset = createPresetFromConfig(createDefaultConfig());
    const legacyTrailers = { ...preset.Trailers } as Partial<typeof preset.Trailers>;
    delete legacyTrailers.MediaExcerptWindowStartMinutes;

    const config = normalizeConfig({
      ...legacy,
      MediaExcerptWindowStartMinutes: -3,
      Presets: [{ ...preset, Trailers: { ...legacyTrailers, TrailerSourcePriority: 'excerpt_only' } }]
    });

    expect(config.TrailerSourcePriority).toBe('prefer_local');
    expect(config.MediaExcerptWindowStartMinutes).toBe(0);
    expect(config.MediaExcerptDurationSeconds).toBe(30);
    expect(config.Presets[0].Trailers.TrailerSourcePriority).toBe('excerpt_only');
    expect(config.Presets[0].Trailers.MediaExcerptWindowStartMinutes).toBe(0);
  });
});
