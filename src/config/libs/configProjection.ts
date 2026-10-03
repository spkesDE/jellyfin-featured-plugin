import type { FeaturedPluginConfig, RuntimeConfig } from '../../types/config';
import type { FeaturedDisplaySettings } from '../../types/display';
import type { FeaturedResponse } from '../../types/featured';
import { createDefaultConfig } from './configDefaults';

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
    bannerNavigationPosition: config.BannerNavigationPosition,
    bannerMediaControlsPosition: config.BannerMediaControlsPosition,
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
    heroFadePoints: config.HeroFadePoints.map((point) => ({ position: point.Position, fade: point.Fade })),
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
