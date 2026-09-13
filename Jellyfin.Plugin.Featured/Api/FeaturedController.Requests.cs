namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedBatchRequest
{
    public Guid[] ExcludedItemIds { get; set; } = [];
}

public sealed class FeaturedDisplayedRequest
{
    public Guid ItemId { get; set; }
}

public sealed class FeaturedClearHistoryRequest
{
    public Guid[] UserIds { get; set; } = [];
}
