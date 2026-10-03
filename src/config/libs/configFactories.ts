import { cloneJsonValue } from '../../core/clone';
import { createId } from '../../core/id';
import type {
  FeaturedFilterRule,
  FeaturedManualList,
  FeaturedPluginConfig,
  FeaturedPreset,
  FeaturedSourceRule,
  FeaturedUserProfile,
  SourceType
} from '../../types/config';

export function createSourceRule(type: SourceType = 'RANDOM'): FeaturedSourceRule {
  return {
    Id: createId(),
    Type: type,
    Enabled: true,
    Weight: 100,
    MinimumItems: 0,
    MaximumItems: 0,
    IsFallback: false,
    AllowBackgroundTrailers: true,
    UseMediaPreviewFallback: false,
    UseTrickplayFallback: false,
    UserIds: [],
    EditorUserId: null,
    LibraryIds: [],
    CollectionIds: [],
    PlaylistIds: [],
    ManualListIds: [],
    Tags: [],
    RecentDays: type === 'LATEST_RELEASES' ? 365 : 30,
    Filters: []
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
    Id: createId(),
    UserId: userId,
    Enabled: true,
    UnplayedBoost: 25,
    FavouriteBoost: 20,
    PreferredGenreBoost: 15,
    InProgressSeriesBoost: 30,
    PreferredGenres: []
  };
}

export function createPresetFromConfig(config: FeaturedPluginConfig, name = 'Featured preset'): FeaturedPreset {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    Id: createId(),
    Name: name,
    Enabled: false,
    Priority: 0,
    StartsAt: null,
    EndsAt: null,
    ScheduleType: 'one_time',
    TimeZoneId: timeZone,
    DaysOfWeek: [],
    StartTime: '18:00',
    EndTime: '23:59',
    AnnualStart: '12-01',
    AnnualEnd: '12-31',
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
      EnableAutoplay: config.EnableAutoplay,
      ShowAutoplayButton: config.ShowAutoplayButton,
      AutoplayInterval: config.AutoplayInterval,
      ShowPlayButton: config.ShowPlayButton,
      ShowFavoriteButton: config.ShowFavoriteButton,
      FavoriteButtonPlacement: config.FavoriteButtonPlacement,
      ShowPlaystateButton: config.ShowPlaystateButton,
      PlaystateButtonPlacement: config.PlaystateButtonPlacement,
      ShowDismissalButton: config.ShowDismissalButton,
      DismissalButtonPlacement: config.DismissalButtonPlacement,
      ShowNavigationArrows: config.ShowNavigationArrows,
      BannerNavigationPosition: config.BannerNavigationPosition,
      BannerMediaControlsPosition: config.BannerMediaControlsPosition,
      ShowControlsOnHoverOnly: config.ShowControlsOnHoverOnly,
      InteractOnWholeBanner: config.InteractOnWholeBanner,
      ShowSlidePosition: config.ShowSlidePosition,
      MediaPadding: config.MediaPadding,
      TitleDisplayMode: config.TitleDisplayMode,
      ShowRating: config.ShowRating,
      ShowDescription: config.ShowDescription,
      HideOnTvLayout: config.HideOnTvLayout,
      UseHeroLayout: config.UseHeroLayout,
      HeroHeightMode: config.HeroHeightMode,
      TabletBannerHeight: config.TabletBannerHeight,
      MobileBannerHeight: config.MobileBannerHeight,
      HeroBorderRadius: config.HeroBorderRadius,
      HeroGradientStrength: config.HeroGradientStrength,
      HeroFadeStart: config.HeroFadeStart,
      HeroFadeEnd: config.HeroFadeEnd,
      HeroFadeCurve: config.HeroFadeCurve,
      HeroFadePoints: cloneJsonValue(config.HeroFadePoints),
      HeroTextPosition: config.HeroTextPosition,
      TransitionEffect: config.TransitionEffect,
      HeroBackdropPosition: config.HeroBackdropPosition,
      BannerHeight: config.BannerHeight,
      ShowYear: config.ShowYear,
      ShowRuntime: config.ShowRuntime,
      ShowSecondaryButton: config.ShowSecondaryButton,
      SecondaryButtonText: config.SecondaryButtonText || null,
      ShowPaginationDots: config.ShowPaginationDots,
      Heading: config.Heading || null,
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
