import { describe, expect, it } from 'vitest';
import { toRaw } from 'vue';
import { createPresetFromConfig, createSourceRule } from '../../src/config/libs/configFactories';
import { createConfigStore } from '../../src/config/libs/store';

describe('manual preset loading', () => {
  it('restores every snapshot section without changing schedules or unrelated configuration', () => {
    const store = createConfigStore();
    const config = store.config;
    config.SourceRules = [createSourceRule('RECENTLY_ADDED')];
    config.GlobalFilters = [{ Id: 'rating', Field: 'COMMUNITY_RATING', Operator: 'GTE', Values: ['7'] }];
    config.PersonalizationPolicy.AllowSourceWeights = false;
    config.MaximumItemsPerGenre = 3;
    config.UseHeroLayout = false;
    config.Heading = 'Movie night';
    config.HeroFadePoints = [{ Position: 40, Fade: 20 }];
    config.TrailerDelayMilliseconds = 1250;
    config.YouTubeQualityFilter = 'hd_only';
    config.TrailerOverrides = [
      { ItemId: 'movie', Name: 'Movie', Url: 'https://example.com/trailer.mp4', LocalTrailerItemId: null }
    ];
    store.addPreset('Movie night');
    const preset = config.Presets[0];
    preset.ScheduleType = 'weekly';
    preset.DaysOfWeek = [5];
    preset.Priority = 10;
    const savedPresets = JSON.stringify(config.Presets);
    const manualLists = config.ManualLists;
    const userProfiles = config.UserProfiles;
    config.MaximumParentRating = 8;
    config.Debug = true;
    config.SourceRules = [];
    config.GlobalFilters = [];
    config.PersonalizationPolicy.AllowSourceWeights = true;
    config.MaximumItemsPerGenre = 0;
    config.UseHeroLayout = true;
    config.Heading = 'Changed';
    config.HeroFadePoints = [];
    config.TrailerDelayMilliseconds = 0;
    config.YouTubeQualityFilter = 'disabled';
    config.TrailerOverrides = [];

    store.loadPreset(0);

    const captured = createPresetFromConfig(toRaw(config));
    for (const section of [
      'SourceRules',
      'GlobalFilters',
      'PersonalizationPolicy',
      'Mixer',
      'Layout',
      'Trailers'
    ] as const) {
      // Nullable snapshot strings are normalized to the equivalent empty editor strings.
      expect(captured[section]).toEqual(preset[section]);
    }
    expect(JSON.stringify(config.Presets)).toBe(savedPresets);
    expect(config.ManualLists).toBe(manualLists);
    expect(config.UserProfiles).toBe(userProfiles);
    expect(config.MaximumParentRating).toBe(8);
    expect(config.Debug).toBe(true);
    expect(store.saveState.value).toBe('dirty');
  });

  it('keeps loaded settings independent of the stored snapshot when editing and recapturing', () => {
    const store = createConfigStore();
    store.config.TrailerOverrides = [{ ItemId: 'movie', Name: 'Movie', Url: null, LocalTrailerItemId: 'trailer' }];
    store.addPreset('Original');
    store.loadPreset(0);
    store.config.SourceRules[0].Weight = 7;
    store.config.TrailerOverrides[0].LocalTrailerItemId = 'other';
    store.config.PersonalizationPolicy.Enabled = !store.config.Presets[0].PersonalizationPolicy.Enabled;
    expect(store.config.Presets[0].SourceRules[0].Weight).toBe(100);
    expect(store.config.Presets[0].Trailers.Overrides[0].LocalTrailerItemId).toBe('trailer');
    expect(store.config.Presets[0].PersonalizationPolicy.Enabled).not.toBe(store.config.PersonalizationPolicy.Enabled);

    store.updatePresetSnapshot(0);
    expect(store.config.Presets[0].SourceRules[0].Weight).toBe(7);
    expect(store.config.Presets[0].Enabled).toBe(false);
    store.config.SourceRules[0].Weight = 12;
    expect(store.config.Presets[0].SourceRules[0].Weight).toBe(7);
  });

  it('ignores a missing preset and restores nullable snapshot text as editable empty strings', () => {
    const store = createConfigStore();
    const before = JSON.stringify(store.config);
    store.loadPreset(-1);
    expect(JSON.stringify(store.config)).toBe(before);
    store.addPreset();
    store.config.Heading = 'Changed';
    store.loadPreset(0);
    expect(store.config.Heading).toBe('');
    expect(store.config.PlayButtonText).toBe('');
    expect(store.config.SecondaryButtonText).toBe('');
    expect(store.config).not.toHaveProperty('Overrides');
  });
});
