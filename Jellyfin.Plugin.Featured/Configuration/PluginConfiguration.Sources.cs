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

    public bool UseTrickplayFallback { get; set; }

    public bool UseMediaPreviewFallback { get; set; }

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
