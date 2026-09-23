import type { FeaturedFilterRule, FeaturedManualList, FeaturedPluginConfig, FeaturedPreset, FeaturedSourceRule, FeaturedUserProfile, SourceType } from '../../types/config';
import type { RuntimeConfig } from '../../types/config';
import type { FeaturedDisplaySettings } from '../../types/display';
import type { FeaturedResponse } from '../../types/featured';
import { cloneJsonValue } from '../../core/clone';

const createId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createSourceRule(type: SourceType = 'RANDOM'): FeaturedSourceRule {
  return {
    Id: createId(), Type: type, Enabled: true, Weight: 100,
    MinimumItems: 0, MaximumItems: 0, IsFallback: false, AllowBackgroundTrailers: true,
    UseMediaPreviewFallback: false, UseTrickplayFallback: false, UserIds: [], EditorUserId: null,
    LibraryIds: [], CollectionIds: [], PlaylistIds: [], ManualListIds: [], Tags: [],
    RecentDays: type === 'LATEST_RELEASES' ? 365 : 30, Filters: []
  };
}

export function createFilterRule(): FeaturedFilterRule {
  return { Id: createId(), Field: 'LIBRARY', Operator: 'EQUALS', Values: [] };
}

export function createManualList(name = ''): FeaturedManualList {
  return { Id: createId(), Name: name, Enabled: true, StartsAt: null, EndsAt: null, Items: [] };
}

export function createUserProfile(userId = ''): FeaturedUserProfile {
  return {
    Id: createId(), UserId: userId, Enabled: true, UnplayedBoost: 25, FavouriteBoost: 20,
    PreferredGenreBoost: 15, InProgressSeriesBoost: 30, PreferredGenres: []
  };
}

export function createPresetFromConfig(config: FeaturedPluginConfig, name = 'Featured preset'): FeaturedPreset {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    Id: createId(), Name: name, Enabled: false, Priority: 0, StartsAt: null, EndsAt: null,
    ScheduleType: 'one_time', TimeZoneId: timeZone, DaysOfWeek: [],
    StartTime: '18:00', EndTime: '23:59', AnnualStart: '12-01', AnnualEnd: '12-31',
    SourceRules: cloneJsonValue(config.SourceRules),
    GlobalFilters: cloneJsonValue(config.GlobalFilters),
    PersonalizationPolicy: cloneJsonValue(config.PersonalizationPolicy),
    Mixer: {
      RepeatCooldownDays: config.RepeatCooldownDays,
      RelaxRepeatCooldownWhenNeeded: config.RelaxRepeatCooldownWhenNeeded,
      MaximumItemsPerGenre: config.MaximumItemsPerGenre,
      MaximumItemsPerFranchise: config.MaximumItemsPerFranchise,
      RandomMediaCount: config.RandomMediaCount
    },
    Layout: {
      EnableInfiniteLoading: config.EnableInfiniteLoading,
      EnableAutoplay: config.EnableAutoplay, ShowAutoplayButton: config.ShowAutoplayButton,
      AutoplayInterval: config.AutoplayInterval, ShowPlayButton: config.ShowPlayButton,
      ShowFavoriteButton: config.ShowFavoriteButton,
      FavoriteButtonPlacement: config.FavoriteButtonPlacement,
      ShowPlaystateButton: config.ShowPlaystateButton,
      PlaystateButtonPlacement: config.PlaystateButtonPlacement,
      ShowDismissalButton: config.ShowDismissalButton,
      DismissalButtonPlacement: config.DismissalButtonPlacement,
      ShowNavigationArrows: config.ShowNavigationArrows, ShowControlsOnHoverOnly: config.ShowControlsOnHoverOnly,
      InteractOnWholeBanner: config.InteractOnWholeBanner,
      ShowSlidePosition: config.ShowSlidePosition,
      MediaPadding: config.MediaPadding, TitleDisplayMode: config.TitleDisplayMode,
      ShowRating: config.ShowRating, ShowDescription: config.ShowDescription,
      HideOnTvLayout: config.HideOnTvLayout, UseHeroLayout: config.UseHeroLayout,
      HeroHeightMode: config.HeroHeightMode, TabletBannerHeight: config.TabletBannerHeight,
      MobileBannerHeight: config.MobileBannerHeight, HeroBorderRadius: config.HeroBorderRadius,
      HeroGradientStrength: config.HeroGradientStrength, HeroFadeStart: config.HeroFadeStart,
      HeroFadeEnd: config.HeroFadeEnd, HeroFadeCurve: config.HeroFadeCurve,
      HeroTextPosition: config.HeroTextPosition,
      TransitionEffect: config.TransitionEffect, HeroBackdropPosition: config.HeroBackdropPosition,
      BannerHeight: config.BannerHeight, ShowYear: config.ShowYear, ShowRuntime: config.ShowRuntime,
      ShowSecondaryButton: config.ShowSecondaryButton, SecondaryButtonText: config.SecondaryButtonText || null,
      ShowPaginationDots: config.ShowPaginationDots, Heading: config.Heading || null,
      PlayButtonText: config.PlayButtonText || null
    },
    Trailers: {
      EnableBackgroundTrailers: config.EnableBackgroundTrailers,
      TrailerSourcePriority: config.TrailerSourcePriority,
      StartTrailersMuted: config.StartTrailersMuted,
      ShowTrailerControls: config.ShowTrailerControls,
      TrailerVolumeSliderDirection: config.TrailerVolumeSliderDirection,
      HideYouTubeTrailerUntilControlsFade: config.HideYouTubeTrailerUntilControlsFade,
      WaitForTrailerToFinish: config.WaitForTrailerToFinish,
      TrailerDelayMilliseconds: config.TrailerDelayMilliseconds,
      TrailerStartOffsetSeconds: config.TrailerStartOffsetSeconds,
      TrailerEndOffsetSeconds: config.TrailerEndOffsetSeconds,
      MultipleTrailerMode: config.MultipleTrailerMode,
      AllowTrailersOnMobile: config.AllowTrailersOnMobile,
      Overrides: cloneJsonValue(config.TrailerOverrides)
    }
  };
}

export function refreshPresetFromConfig(preset: FeaturedPreset, config: FeaturedPluginConfig): FeaturedPreset {
  const snapshot = createPresetFromConfig(config, preset.Name);
  return {
    ...snapshot,
    Id: preset.Id,
    Enabled: preset.Enabled,
    Priority: preset.Priority,
    StartsAt: preset.StartsAt,
    EndsAt: preset.EndsAt,
    ScheduleType: preset.ScheduleType,
    TimeZoneId: preset.TimeZoneId,
    DaysOfWeek: cloneJsonValue(preset.DaysOfWeek),
    StartTime: preset.StartTime,
    EndTime: preset.EndTime,
    AnnualStart: preset.AnnualStart,
    AnnualEnd: preset.AnnualEnd
  };
}

export const CONFIG_DEFAULTS: FeaturedPluginConfig = {
  FrontendInjectionMethod: 'automatic',
  EnableFrontendBootstrap: true,
  SourceRules: [createSourceRule('RANDOM')],
  GlobalFilters: [],
  ManualLists: [],
  UserProfiles: [],
  PersonalizationDefaults: {
    UnplayedBoost: 25, FavouriteBoost: 20, PreferredGenreBoost: 15,
    InProgressSeriesBoost: 30, PreferredGenres: []
  },
  PersonalizationPolicy: {
    Enabled: true, AllowSourceSelection: false, AllowSourceWeights: false,
    AllowPreferredGenres: true, AllowUnplayedBoost: true, AllowFavouriteBoost: true,
    AllowInProgressSeriesBoost: true, AllowRepeatCooldown: false
  },
  DismissalPolicy: {
    Enabled: true, AllowTitle: true, AllowSeries: true, AllowFranchise: true
  },
  Presets: [],
  RepeatCooldownDays: 1,
  RelaxRepeatCooldownWhenNeeded: false,
  MaximumItemsPerGenre: 0,
  MaximumItemsPerFranchise: 0,
  RandomMediaCount: 5,
  EnableInfiniteLoading: false,
  MaximumParentRating: -2,
  MaximumParentRatingSubscore: 0,
  EnableAutoplay: true,
  ShowAutoplayButton: true,
  EnableBackgroundTrailers: false,
  TrailerSourcePriority: 'prefer_local',
  StartTrailersMuted: true,
  ShowTrailerControls: true,
  TrailerVolumeSliderDirection: 'down',
  HideYouTubeTrailerUntilControlsFade: true,
  WaitForTrailerToFinish: false,
  TrailerDelayMilliseconds: 1500,
  TrailerStartOffsetSeconds: 0,
  TrailerEndOffsetSeconds: 0,
  MultipleTrailerMode: 'first',
  AllowTrailersOnMobile: false,
  TrailerOverrides: [],
  AutoplayInterval: 10,
  ShowPlayButton: true,
  ShowFavoriteButton: true,
  FavoriteButtonPlacement: 'metadata',
  ShowPlaystateButton: true,
  PlaystateButtonPlacement: 'metadata',
  ShowDismissalButton: true,
  DismissalButtonPlacement: 'metadata',
  ShowNavigationArrows: true,
  ShowControlsOnHoverOnly: false,
  InteractOnWholeBanner: true,
  ShowSlidePosition: true,
  MediaPadding: 0,
  TitleDisplayMode: 'logo',
  ShowRating: true,
  ShowDescription: true,
  HideOnTvLayout: false,
  UseHeroLayout: true,
  HeroHeightMode: 'standard',
  TabletBannerHeight: 400,
  MobileBannerHeight: 340,
  HeroBorderRadius: 0,
  HeroGradientStrength: 85,
  HeroFadeStart: 40,
  HeroFadeEnd: 90,
  HeroFadeCurve: 'balanced',
  HeroTextPosition: 'left',
  TransitionEffect: 'slide',
  HeroBackdropPosition: 'center',
  ReduceImageSize: false,
  EnablePreparedCache: true,
  BannerHeight: 360,
  ShowYear: true,
  ShowRuntime: true,
  ShowSecondaryButton: true,
  SecondaryButtonText: '',
  ShowPaginationDots: true,
  Heading: '',
  PlayButtonText: '',
  Debug: false
};

export function createDefaultConfig(): FeaturedPluginConfig {
  return cloneJsonValue(CONFIG_DEFAULTS);
}

export function createDisplaySettings(config: FeaturedPluginConfig): FeaturedDisplaySettings {
  return {
    showAutoplayButton: config.ShowAutoplayButton,
    enableBackgroundTrailers: config.EnableBackgroundTrailers,
    startTrailersMuted: config.StartTrailersMuted,
    showTrailerControls: config.ShowTrailerControls,
    trailerVolumeSliderDirection: config.TrailerVolumeSliderDirection,
    hideYouTubeTrailerUntilControlsFade: config.HideYouTubeTrailerUntilControlsFade,
    waitForTrailerToFinish: config.WaitForTrailerToFinish,
    trailerDelayMilliseconds: config.TrailerDelayMilliseconds,
    trailerStartOffsetSeconds: config.TrailerStartOffsetSeconds,
    trailerEndOffsetSeconds: config.TrailerEndOffsetSeconds,
    allowTrailersOnMobile: config.AllowTrailersOnMobile,
    showPlayButton: config.ShowPlayButton,
    showFavoriteButton: config.ShowFavoriteButton,
    favoriteButtonPlacement: config.FavoriteButtonPlacement,
    showPlaystateButton: config.ShowPlaystateButton,
    playstateButtonPlacement: config.PlaystateButtonPlacement,
    showDismissalButton: config.DismissalPolicy.Enabled && config.ShowDismissalButton,
    dismissalButtonPlacement: config.DismissalButtonPlacement,
    showNavigationArrows: config.ShowNavigationArrows,
    showControlsOnHoverOnly: config.ShowControlsOnHoverOnly,
    interactOnWholeBanner: config.InteractOnWholeBanner,
    showSlidePosition: config.ShowSlidePosition,
    mediaPadding: config.MediaPadding,
    titleDisplayMode: config.TitleDisplayMode,
    showRating: config.ShowRating,
    showDescription: config.ShowDescription,
    hideOnTvLayout: config.HideOnTvLayout,
    useHeroLayout: config.UseHeroLayout,
    heroHeightMode: config.HeroHeightMode,
    tabletBannerHeight: config.TabletBannerHeight,
    mobileBannerHeight: config.MobileBannerHeight,
    heroBorderRadius: config.HeroBorderRadius,
    heroGradientStrength: config.HeroGradientStrength,
    heroFadeStart: config.HeroFadeStart,
    heroFadeEnd: config.HeroFadeEnd,
    heroFadeCurve: config.HeroFadeCurve,
    heroTextPosition: config.HeroTextPosition,
    transitionEffect: config.TransitionEffect,
    heroBackdropPosition: config.HeroBackdropPosition,
    bannerHeight: config.BannerHeight,
    showYear: config.ShowYear,
    showRuntime: config.ShowRuntime,
    showSecondaryButton: config.ShowSecondaryButton,
    secondaryButtonText: config.SecondaryButtonText || null,
    showPaginationDots: config.ShowPaginationDots,
    heading: config.Heading || null,
    playButtonText: config.PlayButtonText || null
  };
}

export function createRuntimeConfigDefaults(): RuntimeConfig {
  const config = createDefaultConfig();
  return {
    ...createDisplaySettings(config),
    frontendInjectionMethod: config.FrontendInjectionMethod,
    randomMediaCount: config.RandomMediaCount,
    enableInfiniteLoading: config.EnableInfiniteLoading,
    maximumParentRating: config.MaximumParentRating,
    maximumParentRatingSubscore: config.MaximumParentRatingSubscore,
    enableAutoplay: config.EnableAutoplay,
    autoplayInterval: config.AutoplayInterval,
    reduceImageSize: config.ReduceImageSize,
    personalizationEnabled: config.PersonalizationPolicy.Enabled,
    dismissalsEnabled: config.DismissalPolicy.Enabled,
    secondaryButtonText: config.SecondaryButtonText || null,
    heading: config.Heading || null,
    playButtonText: config.PlayButtonText || null,
    debug: config.Debug
  };
}

export function createFeaturedResponseDefaults(): Omit<FeaturedResponse, 'items'> {
  const config = createDefaultConfig();
  return {
    ...createDisplaySettings(config),
    infiniteLoading: config.EnableInfiniteLoading,
    batchSize: 5,
    hasMore: false,
    autoplay: config.EnableAutoplay,
    autoplayInterval: config.AutoplayInterval * 1000,
    reduceImageSizes: config.ReduceImageSize,
    trackDisplayedItems: config.RepeatCooldownDays > 0,
    personalizationEnabled: config.PersonalizationPolicy.Enabled,
    dismissalsEnabled: config.DismissalPolicy.Enabled
  };
}

export function normalizeConfig(value: unknown): FeaturedPluginConfig {
  type LegacyTrailerFallback = { FallBackToRemoteTrailers?: boolean };
  const source = value && typeof value === 'object'
    ? value as Partial<FeaturedPluginConfig> & LegacyTrailerFallback
    : {};
  const config = { ...createDefaultConfig(), ...source };
  const fade = normalizeHeroFade(config.HeroFadeStart, config.HeroFadeEnd, config.HeroFadeCurve);
  config.HeroFadeStart = fade.start;
  config.HeroFadeEnd = fade.end;
  config.HeroFadeCurve = fade.curve;
  config.HeroHeightMode = ['auto', 'compact', 'standard', 'cinematic', 'fullscreen', 'custom'].includes(String(config.HeroHeightMode))
    ? config.HeroHeightMode : 'standard';
  if (config.TrailerSourcePriority === 'prefer_local' && source.FallBackToRemoteTrailers === false) {
    config.TrailerSourcePriority = 'local_only';
  }
  delete config.FallBackToRemoteTrailers;
  config.SourceRules = Array.isArray(source.SourceRules)
    ? source.SourceRules.map((rule) => ({
        ...createSourceRule(rule.Type), ...rule,
        UserIds: Array.isArray(rule.UserIds) ? rule.UserIds : [],
        ManualListIds: Array.isArray(rule.ManualListIds) ? rule.ManualListIds : [],
        Filters: normalizeFilters(rule.Filters)
      }))
    : [createSourceRule('RANDOM')];
  config.GlobalFilters = normalizeFilters(source.GlobalFilters);
  config.ManualLists = Array.isArray(source.ManualLists)
    ? source.ManualLists.map((list) => ({
        ...createManualList(), ...list,
        Items: Array.isArray(list.Items)
          ? list.Items.map((item, index) => ({
              Id: item.Id || createId(), ItemId: item.ItemId || '', Name: item.Name || '', MediaType: item.MediaType || '',
              ProductionYear: item.ProductionYear ?? null, ImageType: item.ImageType === 'Primary' ? 'Primary' : 'Backdrop',
              Position: index,
              StartsAt: item.StartsAt ?? null, EndsAt: item.EndsAt ?? null
            }))
          : []
      }))
    : [];
  config.UserProfiles = Array.isArray(source.UserProfiles)
    ? source.UserProfiles.map((profile) => ({
        ...createUserProfile(profile.UserId), ...profile,
        PreferredGenres: Array.isArray(profile.PreferredGenres) ? profile.PreferredGenres : []
      }))
    : [];
  config.Presets = Array.isArray(source.Presets)
    ? source.Presets.map((preset) => {
        const fallback = createPresetFromConfig(config);
        const legacyTrailers = preset.Trailers as typeof preset.Trailers & LegacyTrailerFallback | undefined;
        const trailers = { ...fallback.Trailers, ...(legacyTrailers ?? {}) };
        if (trailers.TrailerSourcePriority === 'prefer_local' && legacyTrailers?.FallBackToRemoteTrailers === false) {
          trailers.TrailerSourcePriority = 'local_only';
        }
        delete (trailers as typeof trailers & LegacyTrailerFallback).FallBackToRemoteTrailers;
        const normalized = {
          ...fallback, ...preset,
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
                ...createSourceRule(rule.Type), ...cloneJsonValue(rule),
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
        const layoutFade = normalizeHeroFade(
          normalized.Layout.HeroFadeStart,
          normalized.Layout.HeroFadeEnd,
          normalized.Layout.HeroFadeCurve
        );
        normalized.Layout.HeroFadeStart = layoutFade.start;
        normalized.Layout.HeroFadeEnd = layoutFade.end;
        normalized.Layout.HeroFadeCurve = layoutFade.curve;
        normalized.Layout.HeroHeightMode = ['auto', 'compact', 'standard', 'cinematic', 'fullscreen', 'custom']
          .includes(String(normalized.Layout.HeroHeightMode)) ? normalized.Layout.HeroHeightMode : 'standard';
        return normalized;
      })
    : [];
  config.PersonalizationDefaults = {
    ...createDefaultConfig().PersonalizationDefaults,
    ...(source.PersonalizationDefaults ?? {}),
    PreferredGenres: Array.isArray(source.PersonalizationDefaults?.PreferredGenres)
      ? source.PersonalizationDefaults.PreferredGenres : []
  };
  config.PersonalizationPolicy = {
    ...createDefaultConfig().PersonalizationPolicy,
    ...(source.PersonalizationPolicy ?? {})
  };
  config.DismissalPolicy = {
    ...createDefaultConfig().DismissalPolicy,
    ...(source.DismissalPolicy ?? {})
  };
  config.TrailerOverrides = Array.isArray(source.TrailerOverrides)
    ? source.TrailerOverrides.map((entry) => ({
        ItemId: entry.ItemId || '', Name: entry.Name || '', Url: entry.Url || null,
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

function normalizeHeroFade(startValue: unknown, endValue: unknown, curveValue: unknown): {
  start: number; end: number; curve: 'soft' | 'balanced' | 'strong'
} {
  const startNumber = typeof startValue === 'number' && Number.isFinite(startValue) ? startValue : 40;
  const endNumber = typeof endValue === 'number' && Number.isFinite(endValue) ? endValue : 90;
  const start = Math.max(0, Math.min(100, startNumber));
  const end = Math.max(0, Math.min(100, endNumber));
  if (end <= start) return { start: 40, end: 90, curve: normalizeHeroFadeCurve(curveValue) };
  return { start, end, curve: normalizeHeroFadeCurve(curveValue) };
}

function normalizeHeroFadeCurve(value: unknown): 'soft' | 'balanced' | 'strong' {
  return value === 'soft' || value === 'strong' ? value : 'balanced';
}

function normalizeFilters(value: unknown): FeaturedFilterRule[] {
  return Array.isArray(value)
    ? value.map((rule) => ({ ...createFilterRule(), ...rule, Values: Array.isArray(rule.Values) ? rule.Values : [] }))
    : [];
}
