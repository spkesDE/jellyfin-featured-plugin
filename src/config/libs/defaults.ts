import type { FeaturedFilterRule, FeaturedManualList, FeaturedPluginConfig, FeaturedSourceRule, FeaturedUserProfile, SourceType } from '../../types/config';
import type { RuntimeConfig } from '../../types/config';
import type { FeaturedDisplaySettings } from '../../types/display';
import type { FeaturedResponse } from '../../types/featured';

const createId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createSourceRule(type: SourceType = 'RANDOM'): FeaturedSourceRule {
  return {
    Id: createId(), Type: type, Enabled: true, Weight: 100,
    MinimumItems: 0, MaximumItems: 0, IsFallback: false, EditorUserId: null,
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
    Enabled: true, AllowSourceSelection: true, AllowSourceWeights: true,
    AllowPreferredGenres: true, AllowUnplayedBoost: true, AllowFavouriteBoost: true,
    AllowInProgressSeriesBoost: true, AllowRepeatCooldown: false
  },
  RepeatCooldownDays: 0,
  RelaxRepeatCooldownWhenNeeded: false,
  MaximumItemsPerGenre: 0,
  MaximumItemsPerFranchise: 0,
  ExcludeItemsFromSameSeries: false,
  RandomMediaCount: 5,
  EnableInfiniteLoading: false,
  MaximumParentRating: -2,
  MaximumParentRatingSubscore: 0,
  EnableAutoplay: true,
  ShowAutoplayButton: true,
  EnableBackgroundTrailers: false,
  AutoplayInterval: 10,
  ShowPlayButton: true,
  ShowNavigationArrows: true,
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
  return structuredClone(CONFIG_DEFAULTS);
}

export function createDisplaySettings(config: FeaturedPluginConfig): FeaturedDisplaySettings {
  return {
    showAutoplayButton: config.ShowAutoplayButton,
    enableBackgroundTrailers: config.EnableBackgroundTrailers,
    showPlayButton: config.ShowPlayButton,
    showNavigationArrows: config.ShowNavigationArrows,
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
    personalizationEnabled: config.PersonalizationPolicy.Enabled
  };
}

export function normalizeConfig(value: unknown): FeaturedPluginConfig {
  const source = value && typeof value === 'object' ? value as Partial<FeaturedPluginConfig> : {};
  const config = { ...createDefaultConfig(), ...source };
  config.SourceRules = Array.isArray(source.SourceRules)
    ? source.SourceRules.map((rule) => ({
        ...createSourceRule(rule.Type), ...rule,
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
  config.Heading ??= '';
  config.PlayButtonText ??= '';
  config.SecondaryButtonText ??= '';
  return config;
}

function normalizeFilters(value: unknown): FeaturedFilterRule[] {
  return Array.isArray(value)
    ? value.map((rule) => ({ ...createFilterRule(), ...rule, Values: Array.isArray(rule.Values) ? rule.Values : [] }))
    : [];
}
