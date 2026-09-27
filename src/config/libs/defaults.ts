import { cloneJsonValue } from '../../core/clone';
import { createId } from '../../core/id';
import type { FeaturedFilterRule, FeaturedPluginConfig } from '../../types/config';
import { createDefaultConfig } from './configDefaults';
import {
  createFilterRule,
  createManualList,
  createPresetFromConfig,
  createSourceRule,
  createUserProfile
} from './configFactories';
import {
  type LegacyTrailerFallback,
  normalizeHeroLayoutSettings,
  normalizeTrailerSourcePriority
} from './configNormalization';

export function normalizeConfig(value: unknown): FeaturedPluginConfig {
  const source =
    value && typeof value === 'object' ? (value as Partial<FeaturedPluginConfig> & LegacyTrailerFallback) : {};
  const defaults = createDefaultConfig();
  const config = { ...defaults, ...source };
  normalizeHeroLayoutSettings(config);
  config.TrailerSourcePriority = normalizeTrailerSourcePriority(config, source);
  delete config.FallBackToRemoteTrailers;
  config.SourceRules = Array.isArray(source.SourceRules)
    ? source.SourceRules.map((rule) => ({
        ...createSourceRule(rule.Type),
        ...rule,
        UserIds: Array.isArray(rule.UserIds) ? rule.UserIds : [],
        ManualListIds: Array.isArray(rule.ManualListIds) ? rule.ManualListIds : [],
        Filters: normalizeFilters(rule.Filters)
      }))
    : [createSourceRule('RANDOM')];
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
        delete (trailers as typeof trailers & LegacyTrailerFallback).FallBackToRemoteTrailers;
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
            ? preset.SourceRules.map((rule) => ({
                ...createSourceRule(rule.Type),
                ...cloneJsonValue(rule),
                UserIds: Array.isArray(rule.UserIds) ? [...rule.UserIds] : [],
                ManualListIds: Array.isArray(rule.ManualListIds) ? [...rule.ManualListIds] : [],
                Filters: normalizeFilters(rule.Filters)
              }))
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
