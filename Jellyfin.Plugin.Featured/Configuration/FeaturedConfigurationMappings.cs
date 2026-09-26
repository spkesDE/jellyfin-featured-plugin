namespace Jellyfin.Plugin.Featured;

/// <summary>
/// Owns the explicit copies between persisted preset sections and the effective root configuration.
/// The assignments are intentionally visible: both shapes are compatibility boundaries and a new
/// setting should require a deliberate mapping decision rather than disappearing in reflection code.
/// </summary>
internal static class FeaturedConfigurationMappings
{
    internal static void ApplyPreset(PluginConfiguration target, FeaturedPreset preset)
    {
        target.SourceRules = preset.SourceRules;
        target.GlobalFilters = preset.GlobalFilters;
        target.PersonalizationPolicy = preset.PersonalizationPolicy;

        ApplyMixer(target, preset.Mixer);
        ApplyLayout(target, preset.Layout);
        ApplyTrailers(target, preset.Trailers);
    }

    private static void ApplyMixer(PluginConfiguration target, FeaturedPresetMixerSettings source)
    {
        target.RepeatCooldownDays = source.RepeatCooldownDays;
        target.RelaxRepeatCooldownWhenNeeded = source.RelaxRepeatCooldownWhenNeeded;
        target.MaximumItemsPerGenre = source.MaximumItemsPerGenre;
        target.MaximumItemsPerFranchise = source.MaximumItemsPerFranchise;
        target.RandomMediaCount = source.RandomMediaCount;
    }

    private static void ApplyLayout(PluginConfiguration target, FeaturedPresetLayoutSettings source)
    {
        target.EnableInfiniteLoading = source.EnableInfiniteLoading;
        target.EnableAutoplay = source.EnableAutoplay;
        target.ShowAutoplayButton = source.ShowAutoplayButton;
        target.AutoplayInterval = source.AutoplayInterval;
        target.ShowPlayButton = source.ShowPlayButton;
        target.ShowFavoriteButton = source.ShowFavoriteButton;
        target.FavoriteButtonPlacement = source.FavoriteButtonPlacement;
        target.ShowPlaystateButton = source.ShowPlaystateButton;
        target.PlaystateButtonPlacement = source.PlaystateButtonPlacement;
        target.ShowDismissalButton = source.ShowDismissalButton;
        target.DismissalButtonPlacement = source.DismissalButtonPlacement;
        target.ShowNavigationArrows = source.ShowNavigationArrows;
        target.ShowControlsOnHoverOnly = source.ShowControlsOnHoverOnly;
        target.InteractOnWholeBanner = source.InteractOnWholeBanner;
        target.ShowSlidePosition = source.ShowSlidePosition;
        target.MediaPadding = source.MediaPadding;
        target.TitleDisplayMode = source.TitleDisplayMode;
        target.ShowRating = source.ShowRating;
        target.ShowDescription = source.ShowDescription;
        target.HideOnTvLayout = source.HideOnTvLayout;
        target.UseHeroLayout = source.UseHeroLayout;
        target.HeroHeightMode = source.HeroHeightMode;
        target.TabletBannerHeight = source.TabletBannerHeight;
        target.MobileBannerHeight = source.MobileBannerHeight;
        target.HeroBorderRadius = source.HeroBorderRadius;
        target.HeroGradientStrength = source.HeroGradientStrength;
        target.HeroFadeStart = source.HeroFadeStart;
        target.HeroFadeEnd = source.HeroFadeEnd;
        target.HeroFadeCurve = source.HeroFadeCurve;
        target.HeroFadePoints = source.HeroFadePoints
            .Select(point => new HeroFadePoint { Position = point.Position, Fade = point.Fade })
            .ToArray();
        target.HeroTextPosition = source.HeroTextPosition;
        target.TransitionEffect = source.TransitionEffect;
        target.HeroBackdropPosition = source.HeroBackdropPosition;
        target.BannerHeight = source.BannerHeight;
        target.ShowYear = source.ShowYear;
        target.ShowRuntime = source.ShowRuntime;
        target.ShowSecondaryButton = source.ShowSecondaryButton;
        target.SecondaryButtonText = source.SecondaryButtonText;
        target.ShowPaginationDots = source.ShowPaginationDots;
        target.Heading = source.Heading;
        target.PlayButtonText = source.PlayButtonText;
    }

    private static void ApplyTrailers(PluginConfiguration target, FeaturedPresetTrailerSettings source)
    {
        target.EnableBackgroundTrailers = source.EnableBackgroundTrailers;
        target.TrailerSourcePriority = source.TrailerSourcePriority;
        target.StartTrailersMuted = source.StartTrailersMuted;
        target.ShowTrailerControls = source.ShowTrailerControls;
        target.TrailerVolumeSliderDirection = source.TrailerVolumeSliderDirection;
        target.HideYouTubeTrailerUntilControlsFade = source.HideYouTubeTrailerUntilControlsFade;
        target.WaitForTrailerToFinish = source.WaitForTrailerToFinish;
        target.TrailerDelayMilliseconds = source.TrailerDelayMilliseconds;
        target.TrailerStartOffsetSeconds = source.TrailerStartOffsetSeconds;
        target.TrailerEndOffsetSeconds = source.TrailerEndOffsetSeconds;
        target.MultipleTrailerMode = source.MultipleTrailerMode;
        target.AllowTrailersOnMobile = source.AllowTrailersOnMobile;
        target.TrailerOverrides = source.Overrides;
    }
}
