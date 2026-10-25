import { cloneJsonValue } from '../../core/clone';
import { createId } from '../../core/id';
import type {
  FeaturedFilterRule,
  FeaturedMediaPriorityEntry,
  FeaturedPluginConfig,
  FeaturedSourceRule,
  TrailerSourcePriority
} from '../../types/config';
import { createDefaultConfig } from './configDefaults';
import {
  createFilterRule,
  createManualList,
  createPresetFromConfig,
  createSourceRule,
  createUserProfile
} from './configFactories';
import {
  type LegacySourceMediaFallback,
  type LegacyTrailerFallback,
  normalizeHeroLayoutSettings,
  mediaPriorityFromTrailerSource,
  normalizeMediaExcerptSettings,
  normalizeMediaPriority,
  normalizeSourceMediaPriority,
  normalizeTrailerSourcePriority
} from './configNormalization';

export function normalizeConfig(value: unknown): FeaturedPluginConfig {
  const source =
    value && typeof value === 'object' ? (value as Partial<FeaturedPluginConfig> & LegacyTrailerFallback) : {};
  const defaults = createDefaultConfig();
  const config = { ...defaults, ...source };
  config.YouTubeQualityFilter = config.YouTubeQualityFilter === 'hd_only' ? 'hd_only' : 'disabled';
  normalizeHeroLayoutSettings(config);
  config.TrailerSourcePriority = normalizeTrailerSourcePriority(config, source);
  delete config.FallBackToRemoteTrailers;
  normalizeMediaExcerptSettings(config);
  config.DefaultMediaPriority = normalizeDefaultMediaPriority(
    source.DefaultMediaPriority,
    config.TrailerSourcePriority
  );
  config.SourceRules = Array.isArray(source.SourceRules)
    ? source.SourceRules.map((rule) => normalizeSourceRule(rule, config.TrailerSourcePriority))
    : [createSourceRule('RANDOM', config.DefaultMediaPriority)];
  config.GlobalFilters = normalizeFilters(source.GlobalFilters);
  config.ManualLists = Array.isArray(source.ManualLists)
    ? source.ManualLists.map((list) => ({
        ...createManualList(),
        ...list,
        Items: Array.isArray(list.Items)
          ? list.Items.map((item, index) => ({
              Id: item.Id || createId(),
              ItemId: item.ItemId || '',
              Name: item.Name || '',
              MediaType: item.MediaType || '',
              ProductionYear: item.ProductionYear ?? null,
              ImageType: item.ImageType === 'Primary' ? 'Primary' : 'Backdrop',
              Position: index,
              StartsAt: item.StartsAt ?? null,
              EndsAt: item.EndsAt ?? null
            }))
          : []
      }))
    : [];
  config.UserProfiles = Array.isArray(source.UserProfiles)
    ? source.UserProfiles.map((profile) => ({
        ...createUserProfile(profile.UserId),
        ...profile,
        PreferredGenres: Array.isArray(profile.PreferredGenres) ? profile.PreferredGenres : []
      }))
    : [];
  config.Presets = Array.isArray(source.Presets)
    ? source.Presets.map((preset) => {
        const fallback = createPresetFromConfig(config);
        const legacyTrailers = preset.Trailers as (typeof preset.Trailers & LegacyTrailerFallback) | undefined;
        const trailers = { ...fallback.Trailers, ...(legacyTrailers ?? {}) };
        trailers.TrailerSourcePriority = normalizeTrailerSourcePriority(trailers, legacyTrailers);
        trailers.DefaultMediaPriority = normalizeDefaultMediaPriority(
          legacyTrailers?.DefaultMediaPriority,
          trailers.TrailerSourcePriority
        );
        delete (trailers as typeof trailers & LegacyTrailerFallback).FallBackToRemoteTrailers;
        trailers.YouTubeQualityFilter = legacyTrailers?.YouTubeQualityFilter === 'hd_only' ? 'hd_only' : 'disabled';
        normalizeMediaExcerptSettings(trailers);
        const normalized = {
          ...fallback,
          ...preset,
          Id: preset.Id || fallback.Id,
          Name: preset.Name || fallback.Name,
          StartsAt: preset.StartsAt ?? null,
          EndsAt: preset.EndsAt ?? null,
          ScheduleType: ['weekly', 'annual'].includes(String(preset.ScheduleType)) ? preset.ScheduleType : 'one_time',
          TimeZoneId: preset.TimeZoneId || fallback.TimeZoneId,
          DaysOfWeek: Array.isArray(preset.DaysOfWeek) ? preset.DaysOfWeek : [],
          StartTime: preset.StartTime || fallback.StartTime,
          EndTime: preset.EndTime || fallback.EndTime,
          AnnualStart: preset.AnnualStart || fallback.AnnualStart,
          AnnualEnd: preset.AnnualEnd || fallback.AnnualEnd,
          SourceRules: Array.isArray(preset.SourceRules)
            ? preset.SourceRules.map((rule) =>
                normalizeSourceRule(cloneJsonValue(rule), trailers.TrailerSourcePriority)
              )
            : fallback.SourceRules,
          GlobalFilters: normalizeFilters(preset.GlobalFilters),
          PersonalizationPolicy: { ...fallback.PersonalizationPolicy, ...(preset.PersonalizationPolicy ?? {}) },
          Mixer: { ...fallback.Mixer, ...(preset.Mixer ?? {}) },
          Layout: { ...fallback.Layout, ...(preset.Layout ?? {}) },
          Trailers: trailers
        };
        normalizeHeroLayoutSettings(normalized.Layout);
        return normalized;
      })
    : [];
  config.PersonalizationDefaults = {
    ...defaults.PersonalizationDefaults,
    ...(source.PersonalizationDefaults ?? {}),
    PreferredGenres: Array.isArray(source.PersonalizationDefaults?.PreferredGenres)
      ? source.PersonalizationDefaults.PreferredGenres
      : []
  };
  config.PersonalizationPolicy = {
    ...defaults.PersonalizationPolicy,
    ...(source.PersonalizationPolicy ?? {})
  };
  config.DismissalPolicy = {
    ...defaults.DismissalPolicy,
    ...(source.DismissalPolicy ?? {})
  };
  config.TrailerOverrides = Array.isArray(source.TrailerOverrides)
    ? source.TrailerOverrides.map((entry) => ({
        ItemId: entry.ItemId || '',
        Name: entry.Name || '',
        Url: entry.Url || null,
        LocalTrailerItemId: entry.LocalTrailerItemId || null
      }))
    : [];
  config.Heading ??= '';
  config.PlayButtonText ??= '';
  config.SecondaryButtonText ??= '';
  config.FavoriteButtonPlacement = config.FavoriteButtonPlacement === 'actions' ? 'actions' : 'metadata';
  config.PlaystateButtonPlacement = config.PlaystateButtonPlacement === 'actions' ? 'actions' : 'metadata';
  config.DismissalButtonPlacement = config.DismissalButtonPlacement === 'actions' ? 'actions' : 'metadata';
  return config;
}

function normalizeSourceRule(
  rule: FeaturedSourceRule,
  trailerSourcePriority: TrailerSourcePriority
): FeaturedSourceRule {
  const { UseTrickplayFallback, UseMediaPreviewFallback, ...current } = rule as FeaturedSourceRule &
    LegacySourceMediaFallback;
  return {
    ...createSourceRule(rule.Type),
    ...current,
    Name: typeof rule.Name === 'string' ? rule.Name.trim() : '',
    YouTubeQualityFilter: ['enabled', 'disabled'].includes(rule.YouTubeQualityFilter)
      ? rule.YouTubeQualityFilter
      : 'inherit',
    MediaPriority: normalizeSourceMediaPriority(
      { MediaPriority: rule.MediaPriority, UseTrickplayFallback, UseMediaPreviewFallback },
      trailerSourcePriority
    ),
    UserIds: Array.isArray(rule.UserIds) ? [...rule.UserIds] : [],
    ManualListIds: Array.isArray(rule.ManualListIds) ? [...rule.ManualListIds] : [],
    Filters: normalizeFilters(rule.Filters)
  };
}

/** Configurations saved before the list existed derive it from the trailer source priority of the same scope. */
function normalizeDefaultMediaPriority(
  value: unknown,
  trailerSourcePriority: TrailerSourcePriority
): FeaturedMediaPriorityEntry[] {
  return Array.isArray(value) ? normalizeMediaPriority(value) : mediaPriorityFromTrailerSource(trailerSourcePriority);
}

function normalizeFilters(value: unknown): FeaturedFilterRule[] {
  return Array.isArray(value)
    ? value.map((rule) => ({ ...createFilterRule(), ...rule, Values: Array.isArray(rule.Values) ? rule.Values : [] }))
    : [];
}

export { CONFIG_DEFAULTS, createDefaultConfig } from './configDefaults';
export {
  createFilterRule,
  createManualList,
  createPresetFromConfig,
  createSourceRule,
  createUserProfile,
  refreshPresetFromConfig
} from './configFactories';
export { createDisplaySettings, createFeaturedResponseDefaults, createRuntimeConfigDefaults } from './configProjection';
