namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedBatchRequest
{
    public Guid[] ExcludedItemIds { get; set; } = [];
}

public sealed class FeaturedDisplayedRequest
{
    public Guid ItemId { get; set; }
}

public sealed class FeaturedFavoriteChangedRequest
{
    public Guid ItemId { get; set; }
}

public sealed class FeaturedPlaystateChangedRequest
{
    public Guid ItemId { get; set; }
}

public sealed class FeaturedDismissalRequest
{
    public Guid ItemId { get; set; }
    public string Scope { get; set; } = FeaturedDismissalScopes.Title;
}

public sealed class FeaturedDismissalUndoRequest
{
    public string DismissalId { get; set; } = string.Empty;
}

public sealed class FeaturedClearHistoryRequest
{
    public Guid[] UserIds { get; set; } = [];
}

public sealed class FeaturedFeedPreviewRequest
{
    public PluginConfiguration? Configuration { get; set; }

    public Guid? UserId { get; set; }

    public string? PresetId { get; set; }

    public bool UseDefaultConfiguration { get; set; }
}
