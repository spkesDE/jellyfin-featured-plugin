namespace Jellyfin.Plugin.Featured;

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

    public bool AllowSourceSelection { get; set; } = false;

    public bool AllowSourceWeights { get; set; } = false;

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
    public const string Recommendations = "RECOMMENDATIONS";
    public const string ContinueWatching = "CONTINUE_WATCHING";
    public const string NextUp = "NEXT_UP";
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
    public const string VideoResolution = "VIDEO_RESOLUTION";
    public const string Actor = "ACTOR";
    public const string Director = "DIRECTOR";
    public const string OriginalLanguage = "ORIGINAL_LANGUAGE";
    public const string AudioLanguage = "AUDIO_LANGUAGE";
}

public sealed class FeaturedDismissalPolicy
{
    public bool Enabled { get; set; } = true;

    public bool AllowTitle { get; set; } = true;

    public bool AllowSeries { get; set; } = true;

    public bool AllowFranchise { get; set; } = true;
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
