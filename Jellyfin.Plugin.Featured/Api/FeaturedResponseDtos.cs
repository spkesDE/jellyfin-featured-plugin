using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured.Api;

public abstract class FeaturedDisplaySettingsDto
{
    protected FeaturedDisplaySettingsDto(
        PluginConfiguration config,
        FeaturedPersonalizationContext? personalization = null)
    {
        ShowAutoplayButton = config.ShowAutoplayButton;
        EnableBackgroundTrailers = personalization?.Display.EnableBackgroundTrailers ?? config.EnableBackgroundTrailers;
        StartTrailersMuted = config.StartTrailersMuted;
        ShowTrailerControls = config.ShowTrailerControls;
        TrailerVolumeSliderDirection = config.TrailerVolumeSliderDirection;
        HideYouTubeTrailerUntilControlsFade = config.HideYouTubeTrailerUntilControlsFade;
        WaitForTrailerToFinish = config.WaitForTrailerToFinish;
        TrailerDelayMilliseconds = config.TrailerDelayMilliseconds;
        TrailerStartOffsetSeconds = config.TrailerStartOffsetSeconds;
        TrailerEndOffsetSeconds = config.TrailerEndOffsetSeconds;
        AllowTrailersOnMobile = config.AllowTrailersOnMobile;
        ShowPlayButton = config.ShowPlayButton;
        ShowFavoriteButton = personalization?.Display.ShowFavoriteButton ?? config.ShowFavoriteButton;
        FavoriteButtonPlacement = config.FavoriteButtonPlacement;
        ShowPlaystateButton = personalization?.Display.ShowPlaystateButton ?? config.ShowPlaystateButton;
        PlaystateButtonPlacement = config.PlaystateButtonPlacement;
        ShowDismissalButton = personalization?.Display.ShowDismissalButton
            ?? (config.DismissalPolicy.Enabled && config.ShowDismissalButton);
        DismissalButtonPlacement = config.DismissalButtonPlacement;
        ShowNavigationArrows = config.ShowNavigationArrows;
        BannerNavigationPosition = config.BannerNavigationPosition;
        BannerMediaControlsPosition = config.BannerMediaControlsPosition;
        ShowControlsOnHoverOnly = config.ShowControlsOnHoverOnly;
        InteractOnWholeBanner = config.InteractOnWholeBanner;
        ShowSlidePosition = config.ShowSlidePosition;
        MediaPadding = config.MediaPadding;
        TitleDisplayMode = config.TitleDisplayMode;
        ShowRating = personalization?.Display.ShowRating ?? config.ShowRating;
        ShowDescription = personalization?.Display.ShowDescription ?? config.ShowDescription;
        HideOnTvLayout = config.HideOnTvLayout;
        UseHeroLayout = config.UseHeroLayout;
        HeroHeightMode = config.HeroHeightMode;
        TabletBannerHeight = config.TabletBannerHeight;
        MobileBannerHeight = config.MobileBannerHeight;
        HeroBorderRadius = config.HeroBorderRadius;
        HeroGradientStrength = config.HeroGradientStrength;
        HeroFadeStart = config.HeroFadeStart;
        HeroFadeEnd = config.HeroFadeEnd;
        HeroFadeCurve = config.HeroFadeCurve;
        HeroFadePoints = config.HeroFadePoints
            .Select(point => new HeroFadePointDto(point.Position, point.Fade))
            .ToArray();
        HeroTextPosition = config.HeroTextPosition;
        TransitionEffect = config.TransitionEffect;
        HeroBackdropPosition = config.HeroBackdropPosition;
        BannerHeight = config.BannerHeight;
        ShowYear = personalization?.Display.ShowYear ?? config.ShowYear;
        ShowRuntime = personalization?.Display.ShowRuntime ?? config.ShowRuntime;
        ShowSecondaryButton = config.ShowSecondaryButton;
        SecondaryButtonText = NullIfEmpty(config.SecondaryButtonText);
        ShowPaginationDots = config.ShowPaginationDots;
        Heading = NullIfEmpty(config.Heading);
        PlayButtonText = NullIfEmpty(config.PlayButtonText);
    }

    public bool ShowAutoplayButton { get; }
    public bool EnableBackgroundTrailers { get; }
    public bool StartTrailersMuted { get; }
    public bool ShowTrailerControls { get; }
    public string TrailerVolumeSliderDirection { get; }
    public bool HideYouTubeTrailerUntilControlsFade { get; }
    public bool WaitForTrailerToFinish { get; }
    public int TrailerDelayMilliseconds { get; }
    public int TrailerStartOffsetSeconds { get; }
    public int TrailerEndOffsetSeconds { get; }
    public bool AllowTrailersOnMobile { get; }
    public bool ShowPlayButton { get; }
    public bool ShowFavoriteButton { get; }
    public string FavoriteButtonPlacement { get; }
    public bool ShowPlaystateButton { get; }
    public string PlaystateButtonPlacement { get; }
    public bool ShowDismissalButton { get; }
    public string DismissalButtonPlacement { get; }
    public bool ShowNavigationArrows { get; }
    public string BannerNavigationPosition { get; }
    public string BannerMediaControlsPosition { get; }
    public bool ShowControlsOnHoverOnly { get; }
    public bool InteractOnWholeBanner { get; }
    public bool ShowSlidePosition { get; }
    public int MediaPadding { get; }
    public string TitleDisplayMode { get; }
    public bool ShowRating { get; }
    public bool ShowDescription { get; }
    public bool HideOnTvLayout { get; }
    public bool UseHeroLayout { get; }
    public string HeroHeightMode { get; }
    public int TabletBannerHeight { get; }
    public int MobileBannerHeight { get; }
    public int HeroBorderRadius { get; }
    public int HeroGradientStrength { get; }
    public int HeroFadeStart { get; }
    public int HeroFadeEnd { get; }
    public string HeroFadeCurve { get; }
    public IReadOnlyList<HeroFadePointDto> HeroFadePoints { get; }
    public string HeroTextPosition { get; }
    public string TransitionEffect { get; }
    public string HeroBackdropPosition { get; }
    public int BannerHeight { get; }
    public bool ShowYear { get; }
    public bool ShowRuntime { get; }
    public bool ShowSecondaryButton { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SecondaryButtonText { get; }

    public bool ShowPaginationDots { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Heading { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PlayButtonText { get; }

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
public sealed record HeroFadePointDto(int Position, int Fade);

public sealed class FeaturedRuntimeConfigurationDto : FeaturedDisplaySettingsDto
{
    internal FeaturedRuntimeConfigurationDto(
        PluginConfiguration config,
        string? activePresetId,
        string? activePresetName,
        DateTimeOffset? nextPresetChange)
        : base(config)
    {
        FrontendInjectionMethod = config.FrontendInjectionMethod;
        RandomMediaCount = config.RandomMediaCount;
        EnableInfiniteLoading = config.EnableInfiniteLoading;
        MaximumParentRating = config.MaximumParentRating;
        MaximumParentRatingSubscore = config.MaximumParentRatingSubscore;
        EnableAutoplay = config.EnableAutoplay;
        AutoplayInterval = config.AutoplayInterval;
        ReduceImageSize = config.ReduceImageSize;
        PersonalizationEnabled = config.PersonalizationPolicy.Enabled;
        DismissalsEnabled = config.DismissalPolicy.Enabled;
        Debug = config.Debug;
        ActivePresetId = activePresetId;
        ActivePresetName = activePresetName;
        NextPresetChange = nextPresetChange;
    }

    public string FrontendInjectionMethod { get; }
    public int RandomMediaCount { get; }
    public bool EnableInfiniteLoading { get; }
    public int MaximumParentRating { get; }
    public int MaximumParentRatingSubscore { get; }
    public bool EnableAutoplay { get; }
    public int AutoplayInterval { get; }
    public bool ReduceImageSize { get; }
    public bool PersonalizationEnabled { get; }
    public bool DismissalsEnabled { get; }
    public bool Debug { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetId { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetName { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? NextPresetChange { get; }
}
