import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../src/config/libs/configDefaults';
import { createPresetFromConfig, createSourceRule } from '../../src/config/libs/configFactories';
import {
  normalizeHeroLayoutSettings,
  normalizeMediaExcerptSettings,
  mediaPriorityFromTrailerSource,
  normalizeTrailerSourcePriority
} from '../../src/config/libs/configNormalization';
import { normalizeConfig } from '../../src/config/libs/defaults';
import type { FeaturedSourceRule } from '../../src/types/config';

const sourcesUseMediaExcerpts = (rules: readonly FeaturedSourceRule[]) =>
  rules.some((rule) => rule.MediaPriority.some((entry) => entry.Type === 'media_excerpt' && entry.Enabled));

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

  it('keeps excerpts out of default sources and clamps root and preset excerpt settings', () => {
    const defaults = createDefaultConfig();
    expect(sourcesUseMediaExcerpts(defaults.SourceRules)).toBe(false);
    expect(sourcesUseMediaExcerpts(createPresetFromConfig(defaults).SourceRules)).toBe(false);
    expect(
      sourcesUseMediaExcerpts([createSourceRule('RANDOM', mediaPriorityFromTrailerSource('local_excerpt_remote'))])
    ).toBe(true);

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

  it('migrates legacy source fallbacks into each scope media priority', () => {
    const preset = createPresetFromConfig(createDefaultConfig());
    const legacyRule = (overrides: Record<string, unknown>) => {
      const rule: Record<string, unknown> = { ...createSourceRule('RANDOM'), ...overrides };
      delete rule.MediaPriority;
      return rule;
    };

    const config = normalizeConfig({
      ...createDefaultConfig(),
      TrailerSourcePriority: 'prefer_remote',
      SourceRules: [legacyRule({ UseMediaPreviewFallback: true, UseTrickplayFallback: true })],
      Presets: [
        {
          ...preset,
          Trailers: { ...preset.Trailers, TrailerSourcePriority: 'local_only' },
          SourceRules: [legacyRule({ UseMediaPreviewFallback: false, UseTrickplayFallback: false })]
        }
      ]
    });

    const enabled = (entries: { Type: string; Enabled: boolean }[]) =>
      entries.filter((entry) => entry.Enabled).map((entry) => entry.Type);
    expect(enabled(config.SourceRules[0].MediaPriority)).toEqual([
      'remote_trailer',
      'local_trailer',
      'media_excerpt',
      'trickplay'
    ]);
    expect(config.SourceRules[0]).not.toHaveProperty('UseTrickplayFallback');
    expect(enabled(config.Presets[0].SourceRules[0].MediaPriority)).toEqual(['local_trailer']);
    expect(config.Presets[0].SourceRules[0].MediaPriority).toHaveLength(4);
  });

  it('derives the default media priority from the legacy trailer source priority and keeps a saved one', () => {
    const legacy = createDefaultConfig() as Partial<ReturnType<typeof createDefaultConfig>>;
    delete legacy.DefaultMediaPriority;
    const preset = createPresetFromConfig(createDefaultConfig());
    const savedOrder = [{ Type: 'trickplay' as const, Enabled: true }];

    const config = normalizeConfig({
      ...legacy,
      TrailerSourcePriority: 'remote_only',
      Presets: [{ ...preset, Trailers: { ...preset.Trailers, DefaultMediaPriority: savedOrder } }]
    });

    const enabled = (entries: { Type: string; Enabled: boolean }[]) =>
      entries.filter((entry) => entry.Enabled).map((entry) => entry.Type);
    expect(enabled(config.DefaultMediaPriority)).toEqual(['remote_trailer']);
    expect(enabled(config.Presets[0].Trailers.DefaultMediaPriority)).toEqual(['trickplay']);
    expect(config.Presets[0].Trailers.DefaultMediaPriority).toHaveLength(4);
  });

  it('keeps a saved media priority order and repairs unknown or missing entries', () => {
    const config = normalizeConfig({
      ...createDefaultConfig(),
      SourceRules: [
        {
          ...createSourceRule('RANDOM'),
          MediaPriority: [
            { Type: 'TRICKPLAY', Enabled: true },
            { Type: 'unknown', Enabled: true },
            { Type: 'remote_trailer', Enabled: true },
            { Type: 'trickplay', Enabled: false }
          ]
        }
      ]
    });

    expect(config.SourceRules[0].MediaPriority).toEqual([
      { Type: 'trickplay', Enabled: true },
      { Type: 'remote_trailer', Enabled: true },
      { Type: 'local_trailer', Enabled: false },
      { Type: 'media_excerpt', Enabled: false }
    ]);
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

describe('YouTube quality filter configuration', () => {
  it('defaults old configurations to disabled globally and inherit per source', () => {
    const config = normalizeConfig({ SourceRules: [{ Type: 'RANDOM' }] });
    expect(config.YouTubeQualityFilter).toBe('disabled');
    expect(config.SourceRules[0].YouTubeQualityFilter).toBe('inherit');
    expect(createSourceRule().YouTubeQualityFilter).toBe('inherit');
  });

  it('keeps source overrides and copies the global setting to new presets', () => {
    const config = createDefaultConfig();
    config.YouTubeQualityFilter = 'hd_only';
    config.SourceRules[0].YouTubeQualityFilter = 'disabled';
    const preset = createPresetFromConfig(config);
    expect(preset.Trailers.YouTubeQualityFilter).toBe('hd_only');
    expect(preset.SourceRules[0].YouTubeQualityFilter).toBe('disabled');
    const normalized = normalizeConfig({ ...config, Presets: [preset] });
    expect(normalized.YouTubeQualityFilter).toBe('hd_only');
    expect(normalized.SourceRules[0].YouTubeQualityFilter).toBe('disabled');
    expect(normalized.Presets[0].Trailers.YouTubeQualityFilter).toBe('hd_only');
  });

  it('normalizes invalid settings and preserves disabled behavior for older presets', () => {
    const config = createDefaultConfig();
    config.YouTubeQualityFilter = 'hd_only';
    const preset = createPresetFromConfig(config);
    delete (preset.Trailers as Partial<typeof preset.Trailers>).YouTubeQualityFilter;
    const normalized = normalizeConfig({
      ...config,
      SourceRules: [{ ...config.SourceRules[0], YouTubeQualityFilter: 'invalid' }],
      Presets: [preset]
    });
    expect(normalized.SourceRules[0].YouTubeQualityFilter).toBe('inherit');
    expect(normalized.Presets[0].Trailers.YouTubeQualityFilter).toBe('disabled');
    expect(normalizeConfig({ YouTubeQualityFilter: 'invalid' }).YouTubeQualityFilter).toBe('disabled');
  });
});
