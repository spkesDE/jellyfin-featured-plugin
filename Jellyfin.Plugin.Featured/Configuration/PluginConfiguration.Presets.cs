using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured;

public sealed class FeaturedPreset
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Name { get; set; } = "Featured preset";

    public bool Enabled { get; set; } = true;

    public int Priority { get; set; }

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public string ScheduleType { get; set; } = FeaturedPresetScheduleTypes.OneTime;

    public string TimeZoneId { get; set; } = "UTC";

    public DayOfWeek[] DaysOfWeek { get; set; } = [];

    public string StartTime { get; set; } = "18:00";

    public string EndTime { get; set; } = "23:59";

    public string AnnualStart { get; set; } = "12-01";

    public string AnnualEnd { get; set; } = "12-31";

    public FeaturedSourceRule[] SourceRules { get; set; } = [];

    public FeaturedFilterRule[] GlobalFilters { get; set; } = [];

    public FeaturedPersonalizationPolicy PersonalizationPolicy { get; set; } = new();

    public FeaturedPresetMixerSettings Mixer { get; set; } = new();

    public FeaturedPresetLayoutSettings Layout { get; set; } = new();

    public FeaturedPresetTrailerSettings Trailers { get; set; } = new();
}

public static class FeaturedPresetScheduleTypes
{
    public const string OneTime = "one_time";
    public const string Weekly = "weekly";
    public const string Annual = "annual";
}

public sealed class FeaturedPresetMixerSettings
{
    public int RepeatCooldownDays { get; set; }
    public bool RelaxRepeatCooldownWhenNeeded { get; set; }
    public int MaximumItemsPerGenre { get; set; }
    public int MaximumItemsPerFranchise { get; set; }
    public int RandomMediaCount { get; set; } = 5;
}

public sealed class FeaturedPresetLayoutSettings
{
    public bool EnableInfiniteLoading { get; set; }
    public bool EnableAutoplay { get; set; } = true;
    public bool ShowAutoplayButton { get; set; } = true;
    public int AutoplayInterval { get; set; } = 10;
    public bool ShowPlayButton { get; set; } = true;
    public bool ShowFavoriteButton { get; set; } = true;
    public string FavoriteButtonPlacement { get; set; } = "metadata";
    public bool ShowPlaystateButton { get; set; } = true;
    public string PlaystateButtonPlacement { get; set; } = "metadata";
    public bool ShowDismissalButton { get; set; } = true;
    public string DismissalButtonPlacement { get; set; } = "metadata";
    public bool ShowNavigationArrows { get; set; } = true;
    public bool ShowControlsOnHoverOnly { get; set; }
    public bool InteractOnWholeBanner { get; set; } = true;
    public bool ShowSlidePosition { get; set; } = true;
    public int MediaPadding { get; set; }
    public string TitleDisplayMode { get; set; } = "logo";
    public bool ShowRating { get; set; } = true;
    public bool ShowDescription { get; set; } = true;
    public bool HideOnTvLayout { get; set; }
    public bool UseHeroLayout { get; set; } = true;
    public string HeroHeightMode { get; set; } = "standard";
    public int TabletBannerHeight { get; set; } = 400;
    public int MobileBannerHeight { get; set; } = 340;
    public int HeroBorderRadius { get; set; }
    public int HeroGradientStrength { get; set; } = 100;
    public int HeroFadeStart { get; set; } = 50;
    public int HeroFadeEnd { get; set; } = 100;
    public string HeroFadeCurve { get; set; } = "custom";
    public HeroFadePoint[] HeroFadePoints { get; set; } =
    [
        new() { Position = 0, Fade = 0 },
        new() { Position = 30, Fade = 41 },
        new() { Position = 76, Fade = 67 },
        new() { Position = 100, Fade = 100 }
    ];
    public string HeroTextPosition { get; set; } = "left";
    public string TransitionEffect { get; set; } = "slide";
    public string HeroBackdropPosition { get; set; } = "center";
    public int BannerHeight { get; set; } = 360;
    public bool ShowYear { get; set; } = true;
    public bool ShowRuntime { get; set; } = true;
    public bool ShowSecondaryButton { get; set; } = true;
    public string? SecondaryButtonText { get; set; }
    public bool ShowPaginationDots { get; set; } = true;
    public string? Heading { get; set; }
    public string? PlayButtonText { get; set; }
}

public sealed class HeroFadePoint
{
    public int Position { get; set; }
    public int Fade { get; set; }
}

public sealed class FeaturedPresetTrailerSettings
{
    public bool EnableBackgroundTrailers { get; set; }
    public string TrailerSourcePriority { get; set; } = FeaturedTrailerSourcePriorities.PreferLocal;
    // Read only for migration of presets saved before trailer source owned the fallback.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? FallBackToRemoteTrailers { get; set; }
    public bool StartTrailersMuted { get; set; } = true;
    public bool ShowTrailerControls { get; set; } = true;
    public string TrailerVolumeSliderDirection { get; set; } = "down";
    public bool HideYouTubeTrailerUntilControlsFade { get; set; } = true;
    public bool WaitForTrailerToFinish { get; set; }
    public int TrailerDelayMilliseconds { get; set; } = 1500;
    public int TrailerStartOffsetSeconds { get; set; }
    public int TrailerEndOffsetSeconds { get; set; }
    public string MultipleTrailerMode { get; set; } = FeaturedMultipleTrailerModes.First;
    public bool AllowTrailersOnMobile { get; set; }
    public FeaturedTrailerOverride[] Overrides { get; set; } = [];
}
