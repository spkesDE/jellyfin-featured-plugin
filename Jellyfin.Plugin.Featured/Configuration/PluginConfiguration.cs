using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Featured;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public string FrontendInjectionMethod { get; set; } = FrontendInjectionMethods.Automatic;

    public bool EnableFrontendBootstrap { get; set; } = true;

    public FeaturedSourceRule[] SourceRules { get; set; } =
    [
        new FeaturedSourceRule
        {
            Id = "default-random",
            Type = FeaturedSourceTypes.Random,
            Enabled = true,
            Weight = 100
        }
    ];

    public FeaturedFilterRule[] GlobalFilters { get; set; } = [];

    public FeaturedManualList[] ManualLists { get; set; } = [];

    public FeaturedUserProfile[] UserProfiles { get; set; } = [];

    public FeaturedPersonalizationDefaults PersonalizationDefaults { get; set; } = new();

    public FeaturedPersonalizationPolicy PersonalizationPolicy { get; set; } = new();

    public int RepeatCooldownDays { get; set; }

    public bool RelaxRepeatCooldownWhenNeeded { get; set; }

    public int MaximumItemsPerGenre { get; set; }

    public int MaximumItemsPerFranchise { get; set; }

    public bool ExcludeItemsFromSameSeries { get; set; }

    public int RandomMediaCount { get; set; } = 5;

    public bool EnableInfiniteLoading { get; set; }

    public int MaximumParentRating { get; set; } = -2;

    public int MaximumParentRatingSubscore { get; set; }

    public bool EnableAutoplay { get; set; } = true;

    public bool ShowAutoplayButton { get; set; } = true;

    public bool EnableBackgroundTrailers { get; set; }

    public string TrailerSourcePriority { get; set; } = FeaturedTrailerSourcePriorities.PreferLocal;

    public bool FallBackToRemoteTrailers { get; set; } = true;

    public bool StartTrailersMuted { get; set; } = true;

    public bool WaitForTrailerToFinish { get; set; }

    public int TrailerDelayMilliseconds { get; set; } = 1500;

    public int TrailerStartOffsetSeconds { get; set; }

    public int TrailerEndOffsetSeconds { get; set; }

    public string MultipleTrailerMode { get; set; } = FeaturedMultipleTrailerModes.First;

    public bool AllowTrailersOnMobile { get; set; }

    public FeaturedTrailerOverride[] TrailerOverrides { get; set; } = [];

    public int AutoplayInterval { get; set; } = 10;

    public bool ShowPlayButton { get; set; } = true;

    public bool ShowNavigationArrows { get; set; } = true;

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

    public int HeroGradientStrength { get; set; } = 85;

    public string HeroTextPosition { get; set; } = "left";

    public string TransitionEffect { get; set; } = "slide";

    public string HeroBackdropPosition { get; set; } = "center";

    public bool ReduceImageSize { get; set; }

    public bool EnablePreparedCache { get; set; } = true;

    public int BannerHeight { get; set; } = 360;

    public bool ShowYear { get; set; } = true;

    public bool ShowRuntime { get; set; } = true;

    public bool ShowSecondaryButton { get; set; } = true;

    public string? SecondaryButtonText { get; set; }

    public bool ShowPaginationDots { get; set; } = true;

    public string? Heading { get; set; }

    public string? PlayButtonText { get; set; }

    public bool Debug { get; set; }
}

public sealed class FeaturedSourceRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Type { get; set; } = FeaturedSourceTypes.Random;

    public bool Enabled { get; set; } = true;

    public int Weight { get; set; } = 100;

    public int MinimumItems { get; set; }

    public int MaximumItems { get; set; }

    public bool IsFallback { get; set; }

    public string? EditorUserId { get; set; }

    public string[] LibraryIds { get; set; } = [];

    public string[] CollectionIds { get; set; } = [];

    public string[] PlaylistIds { get; set; } = [];

    public string[] ManualListIds { get; set; } = [];

    public string[] Tags { get; set; } = [];

    public int RecentDays { get; set; } = 30;

    public FeaturedFilterRule[] Filters { get; set; } = [];
}

public sealed class FeaturedFilterRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Field { get; set; } = FeaturedFilterFields.Library;

    public string Operator { get; set; } = FeaturedFilterOperators.Equal;

    public string[] Values { get; set; } = [];
}

public sealed class FeaturedManualList
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Name { get; set; } = "Featured list";

    public bool Enabled { get; set; } = true;

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public FeaturedManualItem[] Items { get; set; } = [];
}

public sealed class FeaturedManualItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string ItemId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string MediaType { get; set; } = string.Empty;

    public int? ProductionYear { get; set; }

    public string ImageType { get; set; } = "Backdrop";

    public int Position { get; set; }

    public DateTimeOffset? StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }
}

public sealed class FeaturedTrailerOverride
{
    public string ItemId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Url { get; set; }

    public string? LocalTrailerItemId { get; set; }
}

public static class FeaturedTrailerSourcePriorities
{
    public const string PreferLocal = "prefer_local";
    public const string PreferRemote = "prefer_remote";
    public const string LocalOnly = "local_only";
    public const string RemoteOnly = "remote_only";
    public const string Automatic = "automatic";
}

public static class FeaturedMultipleTrailerModes
{
    public const string First = "first";
    public const string Random = "random";
}

public sealed class FeaturedUserProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string UserId { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    public int UnplayedBoost { get; set; } = 25;

    public int FavouriteBoost { get; set; } = 20;

    public int PreferredGenreBoost { get; set; } = 15;

    public int InProgressSeriesBoost { get; set; } = 30;

    public string[] PreferredGenres { get; set; } = [];
}

public sealed class FeaturedPersonalizationDefaults
{
    public int UnplayedBoost { get; set; } = 25;

    public int FavouriteBoost { get; set; } = 20;

    public int PreferredGenreBoost { get; set; } = 15;

    public int InProgressSeriesBoost { get; set; } = 30;

    public string[] PreferredGenres { get; set; } = [];
}

public sealed class FeaturedPersonalizationPolicy
{
    public bool Enabled { get; set; } = true;

    public bool AllowSourceSelection { get; set; } = true;

    public bool AllowSourceWeights { get; set; } = true;

    public bool AllowPreferredGenres { get; set; } = true;

    public bool AllowUnplayedBoost { get; set; } = true;

    public bool AllowFavouriteBoost { get; set; } = true;

    public bool AllowInProgressSeriesBoost { get; set; } = true;

    public bool AllowRepeatCooldown { get; set; }
}

public static class FeaturedSourceTypes
{
    public const string Libraries = "LIBRARIES";
    public const string Collections = "COLLECTIONS";
    public const string Favourites = "FAVOURITES";
    public const string Tags = "TAGS";
    public const string Playlists = "PLAYLISTS";
    public const string RecentlyAdded = "RECENTLY_ADDED";
    public const string LatestReleases = "LATEST_RELEASES";
    public const string Random = "RANDOM";
    public const string Unplayed = "UNPLAYED";
    public const string ManualLists = "MANUAL_LISTS";
}

public static class FeaturedFilterFields
{
    public const string Library = "LIBRARY";
    public const string Genre = "GENRE";
    public const string Tag = "TAG";
    public const string MediaType = "MEDIA_TYPE";
    public const string Played = "PLAYED";
    public const string CommunityRating = "COMMUNITY_RATING";
    public const string CriticRating = "CRITIC_RATING";
    public const string ProductionYear = "PRODUCTION_YEAR";
    public const string RuntimeMinutes = "RUNTIME_MINUTES";
}

public static class FeaturedFilterOperators
{
    public const string Equal = "EQUALS";
    public const string NotEquals = "NOT_EQUALS";
    public const string GreaterThanOrEqual = "GTE";
    public const string LessThanOrEqual = "LTE";
    public const string ContainsAny = "CONTAINS_ANY";
    public const string ContainsAll = "CONTAINS_ALL";
}
