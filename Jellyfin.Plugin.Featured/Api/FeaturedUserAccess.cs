using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.Featured.Api;

internal static class FeaturedUserAccess
{
    internal static HashSet<Guid> GetAllowedItemIds(
        IEnumerable<BaseItem> candidates,
        Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        // Jellyfin's standalone visibility check applies item and parent visibility
        // (including parental/tag restrictions) plus enabled and blocked folder access.
        // Evaluate it once per distinct candidate and reuse the result for every rule.
        return candidates
            .Where(item => item.IsVisibleStandalone(activeUser))
            .Select(item => item.Id)
            .ToHashSet();
    }
}
