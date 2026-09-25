export type SourceType = 'LIBRARIES' | 'COLLECTIONS' | 'FAVOURITES' | 'TAGS' | 'PLAYLISTS' | 'RECENTLY_ADDED' | 'LATEST_RELEASES' | 'RANDOM' | 'UNPLAYED' | 'MANUAL_LISTS' | 'RECOMMENDATIONS' | 'CONTINUE_WATCHING' | 'NEXT_UP';
export type FilterField = 'LIBRARY' | 'GENRE' | 'TAG' | 'MEDIA_TYPE' | 'PLAYED' | 'COMMUNITY_RATING' | 'CRITIC_RATING' | 'PRODUCTION_YEAR' | 'RUNTIME_MINUTES' | 'VIDEO_RESOLUTION' | 'ACTOR' | 'DIRECTOR' | 'ORIGINAL_LANGUAGE' | 'AUDIO_LANGUAGE';
export type FilterOperator = 'EQUALS' | 'NOT_EQUALS' | 'GTE' | 'LTE' | 'CONTAINS_ANY' | 'CONTAINS_ALL';
export type FrontendInjectionMethod = 'automatic' | 'file-transformation' | 'javascript-injector' | 'direct';
export type TransitionEffect = 'slide' | 'fade';
export type HeroBackdropPosition = 'top' | 'center' | 'bottom';
export type HeroHeightMode = 'auto' | 'compact' | 'standard' | 'cinematic' | 'fullscreen' | 'custom';
export type HeroFadeCurve = 'soft' | 'balanced' | 'strong';
export type HeroTextPosition = 'left' | 'center' | 'right';
export type TrailerSourcePriority = 'prefer_local' | 'prefer_remote' | 'local_only' | 'remote_only' | 'automatic';
export type MultipleTrailerMode = 'first' | 'random';
export type TrailerVolumeSliderDirection = 'side' | 'up' | 'down';
export type FeatureControlPlacement = 'metadata' | 'actions';
export type PresetScheduleType = 'one_time' | 'weekly' | 'annual';

import type { FeaturedDisplaySettings } from './display';

export interface FeaturedFilterRule {
  Id: string;
  Field: FilterField;
  Operator: FilterOperator;
  Values: string[];
}

export interface FeaturedSourceRule {
  Id: string;
  Type: SourceType;
  Enabled: boolean;
  Weight: number;
  MinimumItems: number;
  MaximumItems: number;
  IsFallback: boolean;
  AllowBackgroundTrailers: boolean;
  UseTrickplayFallback: boolean;
  UseMediaPreviewFallback: boolean;
  UserIds: string[];
  EditorUserId: string | null;
  LibraryIds: string[];
  CollectionIds: string[];
  PlaylistIds: string[];
  ManualListIds: string[];
  Tags: string[];
  RecentDays: number;
  Filters: FeaturedFilterRule[];
}

export interface FeaturedPluginConfig {
  FrontendInjectionMethod: FrontendInjectionMethod;
  EnableFrontendBootstrap: boolean;
  SourceRules: FeaturedSourceRule[];
  GlobalFilters: FeaturedFilterRule[];
  ManualLists: FeaturedManualList[];
  UserProfiles: FeaturedUserProfile[];
  PersonalizationDefaults: FeaturedPersonalizationDefaults;
  PersonalizationPolicy: FeaturedPersonalizationPolicy;
  DismissalPolicy: FeaturedDismissalPolicy;
  Presets: FeaturedPreset[];
  RepeatCooldownDays: number;
  RelaxRepeatCooldownWhenNeeded: boolean;
  MaximumItemsPerGenre: number;
  MaximumItemsPerFranchise: number;
  RandomMediaCount: number;
  EnableInfiniteLoading: boolean;
  MaximumParentRating: number;
  MaximumParentRatingSubscore: number;
  EnableAutoplay: boolean;
  ShowAutoplayButton: boolean;
  EnableBackgroundTrailers: boolean;
  TrailerSourcePriority: TrailerSourcePriority;
  StartTrailersMuted: boolean;
  ShowTrailerControls: boolean;
  TrailerVolumeSliderDirection: TrailerVolumeSliderDirection;
  HideYouTubeTrailerUntilControlsFade: boolean;
  WaitForTrailerToFinish: boolean;
  TrailerDelayMilliseconds: number;
  TrailerStartOffsetSeconds: number;
  TrailerEndOffsetSeconds: number;
  MultipleTrailerMode: MultipleTrailerMode;
  AllowTrailersOnMobile: boolean;
  TrailerOverrides: FeaturedTrailerOverride[];
  AutoplayInterval: number;
  ShowPlayButton: boolean;
  ShowFavoriteButton: boolean;
  FavoriteButtonPlacement: FeatureControlPlacement;
  ShowPlaystateButton: boolean;
  PlaystateButtonPlacement: FeatureControlPlacement;
  ShowDismissalButton: boolean;
  DismissalButtonPlacement: FeatureControlPlacement;
  ShowNavigationArrows: boolean;
  ShowControlsOnHoverOnly: boolean;
  InteractOnWholeBanner: boolean;
  ShowSlidePosition: boolean;
  MediaPadding: number;
  TitleDisplayMode: 'logo' | 'title';
  ShowRating: boolean;
  ShowDescription: boolean;
  HideOnTvLayout: boolean;
  UseHeroLayout: boolean;
  HeroHeightMode: HeroHeightMode;
  TabletBannerHeight: number;
  MobileBannerHeight: number;
  HeroBorderRadius: number;
  HeroGradientStrength: number;
  HeroFadeStart: number;
  HeroFadeEnd: number;
  HeroFadeCurve: HeroFadeCurve;
  HeroTextPosition: HeroTextPosition;
  TransitionEffect: TransitionEffect;
  HeroBackdropPosition: HeroBackdropPosition;
  ReduceImageSize: boolean;
  EnablePreparedCache: boolean;
  BannerHeight: number;
  ShowYear: boolean;
  ShowRuntime: boolean;
  ShowSecondaryButton: boolean;
  SecondaryButtonText: string;
  ShowPaginationDots: boolean;
  Heading: string;
  PlayButtonText: string;
  Debug: boolean;
}

export interface FeaturedPreset {
  Id: string;
  Name: string;
  Enabled: boolean;
  Priority: number;
  StartsAt: string | null;
  EndsAt: string | null;
  ScheduleType: PresetScheduleType;
  TimeZoneId: string;
  DaysOfWeek: number[];
  StartTime: string;
  EndTime: string;
  AnnualStart: string;
  AnnualEnd: string;
  SourceRules: FeaturedSourceRule[];
  GlobalFilters: FeaturedFilterRule[];
  PersonalizationPolicy: FeaturedPersonalizationPolicy;
  Mixer: FeaturedPresetMixerSettings;
  Layout: FeaturedPresetLayoutSettings;
  Trailers: FeaturedPresetTrailerSettings;
}

export interface FeaturedPresetMixerSettings {
  RepeatCooldownDays: number;
  RelaxRepeatCooldownWhenNeeded: boolean;
  MaximumItemsPerGenre: number;
  MaximumItemsPerFranchise: number;
  RandomMediaCount: number;
}

export interface FeaturedPresetLayoutSettings {
  EnableInfiniteLoading: boolean;
  EnableAutoplay: boolean;
  ShowAutoplayButton: boolean;
  AutoplayInterval: number;
  ShowPlayButton: boolean;
  ShowFavoriteButton: boolean;
  FavoriteButtonPlacement: FeatureControlPlacement;
  ShowPlaystateButton: boolean;
  PlaystateButtonPlacement: FeatureControlPlacement;
  ShowDismissalButton: boolean;
  DismissalButtonPlacement: FeatureControlPlacement;
  ShowNavigationArrows: boolean;
  ShowControlsOnHoverOnly: boolean;
  InteractOnWholeBanner: boolean;
  ShowSlidePosition: boolean;
  MediaPadding: number;
  TitleDisplayMode: 'logo' | 'title';
  ShowRating: boolean;
  ShowDescription: boolean;
  HideOnTvLayout: boolean;
  UseHeroLayout: boolean;
  HeroHeightMode: HeroHeightMode;
  TabletBannerHeight: number;
  MobileBannerHeight: number;
  HeroBorderRadius: number;
  HeroGradientStrength: number;
  HeroFadeStart: number;
  HeroFadeEnd: number;
  HeroFadeCurve: HeroFadeCurve;
  HeroTextPosition: HeroTextPosition;
  TransitionEffect: TransitionEffect;
  HeroBackdropPosition: HeroBackdropPosition;
  BannerHeight: number;
  ShowYear: boolean;
  ShowRuntime: boolean;
  ShowSecondaryButton: boolean;
  SecondaryButtonText: string | null;
  ShowPaginationDots: boolean;
  Heading: string | null;
  PlayButtonText: string | null;
}

export interface FeaturedPresetTrailerSettings {
  EnableBackgroundTrailers: boolean;
  TrailerSourcePriority: TrailerSourcePriority;
  StartTrailersMuted: boolean;
  ShowTrailerControls: boolean;
  TrailerVolumeSliderDirection: TrailerVolumeSliderDirection;
  HideYouTubeTrailerUntilControlsFade: boolean;
  WaitForTrailerToFinish: boolean;
  TrailerDelayMilliseconds: number;
  TrailerStartOffsetSeconds: number;
  TrailerEndOffsetSeconds: number;
  MultipleTrailerMode: MultipleTrailerMode;
  AllowTrailersOnMobile: boolean;
  Overrides: FeaturedTrailerOverride[];
}

export interface FeaturedTrailerOverride {
  ItemId: string;
  Name: string;
  Url: string | null;
  LocalTrailerItemId: string | null;
}

export interface FeaturedManualItem {
  Id: string;
  ItemId: string;
  Name: string;
  MediaType: string;
  ProductionYear: number | null;
  ImageType: 'Backdrop' | 'Primary';
  Position: number;
  StartsAt: string | null;
  EndsAt: string | null;
}

export interface FeaturedManualList {
  Id: string;
  Name: string;
  Enabled: boolean;
  StartsAt: string | null;
  EndsAt: string | null;
  Items: FeaturedManualItem[];
}

export interface FeaturedUserProfile {
  Id: string;
  UserId: string;
  Enabled: boolean;
  UnplayedBoost: number;
  FavouriteBoost: number;
  PreferredGenreBoost: number;
  InProgressSeriesBoost: number;
  PreferredGenres: string[];
}

export interface FeaturedPersonalizationDefaults {
  UnplayedBoost: number;
  FavouriteBoost: number;
  PreferredGenreBoost: number;
  InProgressSeriesBoost: number;
  PreferredGenres: string[];
}

export interface FeaturedPersonalizationPolicy {
  Enabled: boolean;
  AllowSourceSelection: boolean;
  AllowSourceWeights: boolean;
  AllowPreferredGenres: boolean;
  AllowUnplayedBoost: boolean;
  AllowFavouriteBoost: boolean;
  AllowInProgressSeriesBoost: boolean;
  AllowRepeatCooldown: boolean;
}

export interface FeaturedDismissalPolicy {
  Enabled: boolean;
  AllowTitle: boolean;
  AllowSeries: boolean;
  AllowFranchise: boolean;
}

export interface RuntimeConfig extends FeaturedDisplaySettings {
  frontendInjectionMethod: FrontendInjectionMethod;
  randomMediaCount: number;
  enableInfiniteLoading: boolean;
  maximumParentRating: number;
  maximumParentRatingSubscore: number;
  enableAutoplay: boolean;
  autoplayInterval: number;
  reduceImageSize: boolean;
  personalizationEnabled: boolean;
  dismissalsEnabled: boolean;
  secondaryButtonText: string | null;
  heading: string | null;
  playButtonText: string | null;
  debug: boolean;
  activePresetId?: string;
  activePresetName?: string;
  nextPresetChange?: string;
}
