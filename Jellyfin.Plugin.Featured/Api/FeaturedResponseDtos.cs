using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured.Api;

public abstract class FeaturedDisplaySettingsDto
{
    protected FeaturedDisplaySettingsDto(PluginConfiguration config)
    {
        ShowAutoplayButton = config.ShowAutoplayButton;
        EnableBackgroundTrailers = config.EnableBackgroundTrailers;
        ShowPlayButton = config.ShowPlayButton;
        ShowNavigationArrows = config.ShowNavigationArrows;
        ShowSlidePosition = config.ShowSlidePosition;
        MediaPadding = config.MediaPadding;
        TitleDisplayMode = config.TitleDisplayMode;
        ShowRating = config.ShowRating;
        ShowDescription = config.ShowDescription;
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
        ShowYear = config.ShowYear;
        ShowRuntime = config.ShowRuntime;
        ShowSecondaryButton = config.ShowSecondaryButton;
        SecondaryButtonText = NullIfEmpty(config.SecondaryButtonText);
        ShowPaginationDots = config.ShowPaginationDots;
        Heading = NullIfEmpty(config.Heading);
        PlayButtonText = NullIfEmpty(config.PlayButtonText);
    }

    public bool ShowAutoplayButton { get; }
    public bool EnableBackgroundTrailers { get; }
    public bool ShowPlayButton { get; }
    public bool ShowNavigationArrows { get; }
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
    internal FeaturedRuntimeConfigurationDto(PluginConfiguration config)
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
        Debug = config.Debug;
    }

    public string FrontendInjectionMethod { get; }
    public int RandomMediaCount { get; }
    public bool EnableInfiniteLoading { get; }
    public int MaximumParentRating { get; }
    public int MaximumParentRatingSubscore { get; }
    public bool EnableAutoplay { get; }
    public int AutoplayInterval { get; }
    public bool ReduceImageSize { get; }
    public bool Debug { get; }
}

public sealed class FeaturedItemsResponseDto : FeaturedDisplaySettingsDto
{
    internal FeaturedItemsResponseDto(
        PluginConfiguration config,
        IReadOnlyList<FeaturedItemDto> items,
        int batchSize,
        int requestedCount,
        FeaturedPersonalizationContext personalization)
        : base(config)
    {
        Items = items;
        InfiniteLoading = config.EnableInfiniteLoading;
        BatchSize = batchSize;
        HasMore = config.EnableInfiniteLoading && items.Count == requestedCount;
        Autoplay = config.EnableAutoplay;
        AutoplayInterval = config.AutoplayInterval * 1000;
        ReduceImageSizes = config.ReduceImageSize;
        TrackDisplayedItems = personalization.RepeatCooldownDays > 0;
        PersonalizationEnabled = config.PersonalizationPolicy.Enabled;
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
            UnplayedBoost = effective.Profile.UnplayedBoost,
            FavouriteBoost = effective.Profile.FavouriteBoost,
            InProgressSeriesBoost = effective.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = effective.RepeatCooldownDays
        };
        Defaults = new FeaturedEffectivePreferences
        {
            SourceEnabled = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Enabled),
            SourceWeights = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Weight),
            PreferredGenres = defaults.Profile.PreferredGenres,
            UnplayedBoost = defaults.Profile.UnplayedBoost,
            FavouriteBoost = defaults.Profile.FavouriteBoost,
            InProgressSeriesBoost = defaults.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = defaults.RepeatCooldownDays
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
    public int UnplayedBoost { get; set; }
    public int FavouriteBoost { get; set; }
    public int InProgressSeriesBoost { get; set; }
    public int RepeatCooldownDays { get; set; }
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
    public string? LocalTrailerId { get; init; }

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
