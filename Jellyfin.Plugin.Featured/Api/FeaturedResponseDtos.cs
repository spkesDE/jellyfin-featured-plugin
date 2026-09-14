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
        HideYouTubeTrailerUntilControlsFade = config.HideYouTubeTrailerUntilControlsFade;
        WaitForTrailerToFinish = config.WaitForTrailerToFinish;
        TrailerDelayMilliseconds = config.TrailerDelayMilliseconds;
        TrailerStartOffsetSeconds = config.TrailerStartOffsetSeconds;
        TrailerEndOffsetSeconds = config.TrailerEndOffsetSeconds;
        AllowTrailersOnMobile = config.AllowTrailersOnMobile;
        ShowPlayButton = config.ShowPlayButton;
        ShowNavigationArrows = config.ShowNavigationArrows;
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
    public bool HideYouTubeTrailerUntilControlsFade { get; }
    public bool WaitForTrailerToFinish { get; }
    public int TrailerDelayMilliseconds { get; }
    public int TrailerStartOffsetSeconds { get; }
    public int TrailerEndOffsetSeconds { get; }
    public bool AllowTrailersOnMobile { get; }
    public bool ShowPlayButton { get; }
    public bool ShowNavigationArrows { get; }
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
    public bool Debug { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetId { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetName { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? NextPresetChange { get; }
}

public sealed class FeaturedItemsResponseDto : FeaturedDisplaySettingsDto
{
    internal FeaturedItemsResponseDto(
        PluginConfiguration config,
        IReadOnlyList<FeaturedItemDto> items,
        int batchSize,
        int requestedCount,
        FeaturedPersonalizationContext personalization,
        string? activePresetId,
        string? activePresetName,
        DateTimeOffset? nextPresetChange)
        : base(config, personalization)
    {
        Items = items;
        InfiniteLoading = config.EnableInfiniteLoading;
        BatchSize = batchSize;
        HasMore = config.EnableInfiniteLoading && items.Count == requestedCount;
        Autoplay = config.EnableAutoplay;
        AutoplayInterval = config.AutoplayInterval * 1000;
        ReduceImageSizes = config.ReduceImageSize;
        TrackDisplayedItems = personalization.RepeatCooldownHours > 0;
        PersonalizationEnabled = config.PersonalizationPolicy.Enabled;
        ActivePresetId = activePresetId;
        ActivePresetName = activePresetName;
        NextPresetChange = nextPresetChange;
    }

    public IReadOnlyList<FeaturedItemDto> Items { get; }
    public bool InfiniteLoading { get; }
    public int BatchSize { get; }
    public bool HasMore { get; }
    public bool Autoplay { get; }
    public int AutoplayInterval { get; }
    public bool ReduceImageSizes { get; }
    public bool TrackDisplayedItems { get; }
    public bool PersonalizationEnabled { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetId { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetName { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? NextPresetChange { get; }
}

public sealed class FeaturedPreferencesResponse
{
    internal FeaturedPreferencesResponse(
        FeaturedUserPreferences? saved,
        FeaturedPersonalizationContext effective,
        FeaturedPersonalizationContext defaults)
    {
        HasOverrides = saved is not null;
        Preferences = saved ?? new FeaturedUserPreferences();
        Effective = new FeaturedEffectivePreferences
        {
            SourceEnabled = effective.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Enabled),
            SourceWeights = effective.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Weight),
            PreferredGenres = effective.Profile.PreferredGenres,
            ExcludedGenres = effective.ExcludedGenres,
            UnplayedBoost = effective.Profile.UnplayedBoost,
            FavouriteBoost = effective.Profile.FavouriteBoost,
            InProgressSeriesBoost = effective.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = (int)Math.Ceiling(effective.RepeatCooldownHours / 24d),
            RepeatCooldownHours = effective.RepeatCooldownHours,
            Display = effective.Display
        };
        Defaults = new FeaturedEffectivePreferences
        {
            SourceEnabled = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Enabled),
            SourceWeights = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Weight),
            PreferredGenres = defaults.Profile.PreferredGenres,
            ExcludedGenres = defaults.ExcludedGenres,
            UnplayedBoost = defaults.Profile.UnplayedBoost,
            FavouriteBoost = defaults.Profile.FavouriteBoost,
            InProgressSeriesBoost = defaults.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = (int)Math.Ceiling(defaults.RepeatCooldownHours / 24d),
            RepeatCooldownHours = defaults.RepeatCooldownHours,
            Display = defaults.Display
        };
    }

    public bool HasOverrides { get; }
    public FeaturedUserPreferences Preferences { get; }
    public FeaturedEffectivePreferences Effective { get; }
    public FeaturedEffectivePreferences Defaults { get; }
}

public sealed class FeaturedEffectivePreferences
{
    public Dictionary<string, bool> SourceEnabled { get; set; } = [];
    public Dictionary<string, int> SourceWeights { get; set; } = [];
    public string[] PreferredGenres { get; set; } = [];
    public string[] ExcludedGenres { get; set; } = [];
    public int UnplayedBoost { get; set; }
    public int FavouriteBoost { get; set; }
    public int InProgressSeriesBoost { get; set; }
    public int RepeatCooldownDays { get; set; }
    public int RepeatCooldownHours { get; set; }
    public FeaturedDisplayPreferences Display { get; set; } = new(false, false, false, false, false);
}

public sealed class FeaturedPreferencesUpdate
{
    public bool Reset { get; set; }
    public FeaturedUserPreferences? Preferences { get; set; }
}

public sealed class FeaturedPreferenceOptionsResponse
{
    internal FeaturedPreferenceOptionsResponse(FeaturedPersonalizationPolicy policy, FeaturedPreferenceSourceOption[] sources, string[] genres)
    {
        Policy = policy;
        Sources = sources;
        Genres = genres;
    }

    public FeaturedPersonalizationPolicy Policy { get; }
    public FeaturedPreferenceSourceOption[] Sources { get; }
    public string[] Genres { get; }
}

public sealed class FeaturedPreferencesBootstrapResponse
{
    internal FeaturedPreferencesBootstrapResponse(
        FeaturedPreferencesResponse current,
        FeaturedPreferenceOptionsResponse options)
    {
        Current = current;
        Options = options;
    }

    public FeaturedPreferencesResponse Current { get; }
    public FeaturedPreferenceOptionsResponse Options { get; }
}

public sealed class FeaturedPreferenceSourceOption
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public int Weight { get; set; }
}

public sealed class FeaturedItemDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string MediaType { get; init; }
    public required string ImageType { get; init; }
    public required bool HasLogo { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Tagline { get; init; }

    [JsonPropertyName("official_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? OfficialRating { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public FeaturedTrailerDto? Trailer { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<FeaturedTrailerDto>? Trailers { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Overview { get; init; }

    [JsonPropertyName("critic_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public float? CriticRating { get; init; }

    [JsonPropertyName("community_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? CommunityRating { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? ProductionYear { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RuntimeMinutes { get; init; }
}

public sealed class FeaturedFeedPreviewResponse
{
    public string UserId { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string? ActivePresetId { get; init; }
    public string? ActivePresetName { get; init; }
    public DateTimeOffset? NextPresetChange { get; init; }
    public IReadOnlyList<FeaturedFeedPreviewItem> Items { get; init; } = [];
    public IReadOnlyList<FeaturedRuleDiagnostic> Rules { get; init; } = [];
    public int DuplicatesRemoved { get; init; }
    public int CooldownExcluded { get; init; }
    public int DiversitySkipped { get; init; }
    public bool UserProfileApplied { get; init; }
}

public sealed class FeaturedFeedPreviewItem
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
    public int? ProductionYear { get; init; }
    public string SourceId { get; init; } = string.Empty;
    public string SourceType { get; init; } = string.Empty;
}

public sealed class FeaturedTrailerDto
{
    public required string Type { get; init; }
    public required string Provider { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Url { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? VideoId { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ItemId { get; init; }
}
