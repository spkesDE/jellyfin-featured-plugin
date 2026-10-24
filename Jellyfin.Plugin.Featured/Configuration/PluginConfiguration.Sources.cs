using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured;

public sealed class FeaturedSourceRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string Type { get; set; } = FeaturedSourceTypes.Random;

    public bool Enabled { get; set; } = true;

    public int Weight { get; set; } = 100;

    public int MinimumItems { get; set; }

    public int MaximumItems { get; set; }

    public bool IsFallback { get; set; }

    public bool AllowBackgroundTrailers { get; set; } = true;

    public string YouTubeQualityFilter { get; set; } = "inherit";

    public FeaturedMediaPriorityEntry[] MediaPriority { get; set; } = FeaturedMediaPriorityTypes.CreateDefault();

    // Read only for migration of sources saved before the media priority list.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? UseTrickplayFallback { get; set; }

    // Read only for migration of sources saved before the media priority list.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? UseMediaPreviewFallback { get; set; }

    public string[] UserIds { get; set; } = [];

    public string? EditorUserId { get; set; }

    public string[] LibraryIds { get; set; } = [];

    public string[] CollectionIds { get; set; } = [];

    public string[] PlaylistIds { get; set; } = [];

    public string[] ManualListIds { get; set; } = [];

    public string[] Tags { get; set; } = [];

    public int RecentDays { get; set; } = 30;

    public FeaturedFilterRule[] Filters { get; set; } = [];
}

public sealed class FeaturedMediaPriorityEntry
{
    public string Type { get; set; } = FeaturedMediaPriorityTypes.LocalTrailer;

    public bool Enabled { get; set; } = true;
}

/// <summary>
/// The media a source tries, in order, before the banner falls back to its still image.
/// </summary>
public static class FeaturedMediaPriorityTypes
{
    public const string LocalTrailer = "local_trailer";
    public const string RemoteTrailer = "remote_trailer";
    public const string MediaExcerpt = "media_excerpt";
    public const string Trickplay = "trickplay";

    public static readonly string[] All = [LocalTrailer, RemoteTrailer, MediaExcerpt, Trickplay];

    public static bool IsTrailer(string type) => type is LocalTrailer or RemoteTrailer;

    public static FeaturedMediaPriorityEntry[] CreateDefault()
        => FromTrailerSourcePriority(FeaturedTrailerSourcePriorities.PreferLocal);

    /// <summary>
    /// Maps a trailer source priority onto a priority list. Used for new sources and to migrate sources saved
    /// before each source owned its own list.
    /// </summary>
    public static FeaturedMediaPriorityEntry[] FromTrailerSourcePriority(
        string? priority,
        bool useMediaPreviewFallback = false,
        bool useTrickplayFallback = false)
    {
        (string Type, bool Enabled)[] trailers = priority switch
        {
            FeaturedTrailerSourcePriorities.PreferRemote => [(RemoteTrailer, true), (LocalTrailer, true)],
            FeaturedTrailerSourcePriorities.LocalOnly => [(LocalTrailer, true), (RemoteTrailer, false)],
            FeaturedTrailerSourcePriorities.RemoteOnly => [(RemoteTrailer, true), (LocalTrailer, false)],
            FeaturedTrailerSourcePriorities.LocalRemoteExcerpt =>
                [(LocalTrailer, true), (RemoteTrailer, true), (MediaExcerpt, true)],
            FeaturedTrailerSourcePriorities.LocalExcerptRemote =>
                [(LocalTrailer, true), (MediaExcerpt, true), (RemoteTrailer, true)],
            FeaturedTrailerSourcePriorities.ExcerptOnly =>
                [(MediaExcerpt, true), (LocalTrailer, false), (RemoteTrailer, false)],
            _ => [(LocalTrailer, true), (RemoteTrailer, true)]
        };
        List<FeaturedMediaPriorityEntry> entries = trailers
            .Select(entry => new FeaturedMediaPriorityEntry
            {
                Type = entry.Type,
                Enabled = entry.Enabled || (entry.Type == MediaExcerpt && useMediaPreviewFallback)
            })
            .ToList();
        if (entries.All(entry => entry.Type != MediaExcerpt))
        {
            entries.Add(new FeaturedMediaPriorityEntry { Type = MediaExcerpt, Enabled = useMediaPreviewFallback });
        }

        entries.Add(new FeaturedMediaPriorityEntry { Type = Trickplay, Enabled = useTrickplayFallback });
        return entries.ToArray();
    }

    /// <summary>
    /// Keeps each known type exactly once in its saved order and appends missing types disabled.
    /// </summary>
    public static FeaturedMediaPriorityEntry[] Normalize(IEnumerable<FeaturedMediaPriorityEntry?> entries)
    {
        List<FeaturedMediaPriorityEntry> normalized = entries
            .Where(entry => entry is not null)
            .Select(entry => new FeaturedMediaPriorityEntry
            {
                Type = All.FirstOrDefault(type => string.Equals(type, entry!.Type?.Trim(), StringComparison.OrdinalIgnoreCase))
                    ?? string.Empty,
                Enabled = entry!.Enabled
            })
            .Where(entry => entry.Type.Length > 0)
            .DistinctBy(entry => entry.Type)
            .ToList();
        normalized.AddRange(All
            .Where(type => normalized.All(entry => entry.Type != type))
            .Select(type => new FeaturedMediaPriorityEntry { Type = type, Enabled = false }));
        return normalized.ToArray();
    }

    /// <summary>
    /// Excerpts and trickplay come from the video itself, so they can stand in for missing artwork.
    /// </summary>
    public static bool CanFillMissingImages(IEnumerable<FeaturedMediaPriorityEntry> entries)
        => entries.Any(entry => entry.Enabled && !IsTrailer(entry.Type));

    public static string[] EnabledTypes(IEnumerable<FeaturedMediaPriorityEntry> entries)
        => entries.Where(entry => entry.Enabled).Select(entry => entry.Type).ToArray();
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
    public const string LocalRemoteExcerpt = "local_remote_excerpt";
    public const string LocalExcerptRemote = "local_excerpt_remote";
    public const string ExcerptOnly = "excerpt_only";
}

public static class FeaturedMediaExcerptLimits
{
    public const int MaximumWindowMinutes = 600;
    public const int MinimumDurationSeconds = 10;
    public const int MaximumDurationSeconds = 120;
}

public static class FeaturedMultipleTrailerModes
{
    public const string First = "first";
    public const string Random = "random";
}
