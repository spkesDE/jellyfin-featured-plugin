using System.Text.Json;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed partial class FeaturedRuleEngine
{
    private List<BaseItem> GetSourceCandidates(
        FeaturedSourceRule rule,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        int requestedCount)
    {
        int candidateLimit = Math.Clamp(requestedCount * 40, 200, MaximumCandidatesPerRule);
        bool userScoped = IsUserScopedSource(rule);
        string cacheKey = CreateCandidateCacheKey(rule, activeUser, candidateLimit);
        TimeSpan lifetime = userScoped
            ? FeaturedCandidateCache.UserEntryLifetime
            : FeaturedCandidateCache.SharedEntryLifetime;
        return _candidateCache.GetOrCreate(cacheKey, lifetime, () => LoadSourceCandidates(rule, activeUser, candidateLimit));
    }

    private List<BaseItem> LoadSourceCandidates(
        FeaturedSourceRule rule,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        int candidateLimit)
    {
        bool userScoped = IsUserScopedSource(rule);
        IEnumerable<BaseItem> candidates = rule.Type switch
        {
            FeaturedSourceTypes.ManualLists => GetManualListCandidates(rule, candidateLimit),
            FeaturedSourceTypes.Favourites => GetFavouriteCandidates(rule, candidateLimit),
            FeaturedSourceTypes.Collections => GetFolderCandidates(rule.CollectionIds),
            FeaturedSourceTypes.Playlists => GetFolderCandidates(rule.PlaylistIds),
            FeaturedSourceTypes.Recommendations => _recommendations.GetMovieRecommendations(activeUser, candidateLimit),
            FeaturedSourceTypes.ContinueWatching => _mediaMetadata.GetContinueWatching(activeUser, candidateLimit),
            FeaturedSourceTypes.NextUp => _mediaMetadata.GetNextUp(activeUser, candidateLimit),
            _ => QueryStandardCandidates(rule, userScoped ? activeUser : null, candidateLimit)
        };

        List<BaseItem> sourceOrder = candidates.ToList();
        bool preserveEpisodes = rule.Type is FeaturedSourceTypes.ContinueWatching or FeaturedSourceTypes.NextUp;
        bool requiresRequery = rule.Type is FeaturedSourceTypes.Favourites
            or FeaturedSourceTypes.Collections
            or FeaturedSourceTypes.Playlists
            or FeaturedSourceTypes.Recommendations
            or FeaturedSourceTypes.ContinueWatching
            or FeaturedSourceTypes.NextUp;
        List<BaseItem> normalized = requiresRequery
            ? NormalizeAndRequery(
                sourceOrder,
                userScoped ? activeUser : null,
                candidateLimit,
                preserveEpisodes)
            : NormalizeWithoutRequery(sourceOrder, candidateLimit);
        return rule.Type switch
        {
            FeaturedSourceTypes.Libraries => normalized
                .Where(item => rule.LibraryIds.Length > 0 && IsInAnyLibrary(item, rule.LibraryIds))
                .ToList(),
            FeaturedSourceTypes.Tags => normalized
                .Where(item => rule.Tags.Length > 0 && ContainsAny(item.Tags, rule.Tags))
                .ToList(),
            FeaturedSourceTypes.RecentlyAdded => normalized
                .Where(item => item.DateCreated >= DateTime.UtcNow.AddDays(-rule.RecentDays))
                .OrderByDescending(item => item.DateCreated)
                .ToList(),
            FeaturedSourceTypes.LatestReleases => normalized
                .Where(item => item.PremiereDate.HasValue
                    && item.PremiereDate.Value <= DateTime.UtcNow
                    && item.PremiereDate.Value >= DateTime.UtcNow.AddDays(-rule.RecentDays))
                .OrderByDescending(item => item.PremiereDate)
                .ToList(),
            FeaturedSourceTypes.Recommendations or FeaturedSourceTypes.ContinueWatching or FeaturedSourceTypes.NextUp => normalized
                .OrderBy(item => sourceOrder.FindIndex(candidate => candidate.Id == item.Id))
                .ToList(),
            _ => normalized
        };
    }

    private string CreateCandidateCacheKey(
        FeaturedSourceRule rule,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        int candidateLimit)
    {
        bool userScoped = IsUserScopedSource(rule);
        return JsonSerializer.Serialize(new
        {
            Scope = userScoped ? activeUser.Id.ToString("N") : "shared",
            UserParentalRating = userScoped ? activeUser.MaxParentalRatingScore ?? -1 : -1,
            _config.MaximumParentRating,
            _config.MaximumParentRatingSubscore,
            CandidateLimit = candidateLimit,
            rule.Type,
            rule.EditorUserId,
            rule.RecentDays,
            LibraryIds = rule.LibraryIds.Order(StringComparer.OrdinalIgnoreCase).ToArray(),
            CollectionIds = rule.CollectionIds.Order(StringComparer.OrdinalIgnoreCase).ToArray(),
            PlaylistIds = rule.PlaylistIds.Order(StringComparer.OrdinalIgnoreCase).ToArray(),
            ManualListIds = rule.ManualListIds.Order(StringComparer.OrdinalIgnoreCase).ToArray(),
            Tags = rule.Tags.Order(StringComparer.OrdinalIgnoreCase).ToArray(),
            ManualLists = _config.ManualLists
                .Where(list => rule.ManualListIds.Contains(list.Id, StringComparer.OrdinalIgnoreCase))
                .OrderBy(list => list.Id, StringComparer.OrdinalIgnoreCase)
                .ToArray()
        });
    }

    private List<BaseItem> GetManualListCandidates(
        FeaturedSourceRule rule,
        int candidateLimit)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        Dictionary<string, FeaturedManualList> listsById = _config.ManualLists
            .Where(list => list.Enabled && IsActiveAt(list.StartsAt, list.EndsAt, now))
            .ToDictionary(list => list.Id, StringComparer.OrdinalIgnoreCase);
        FeaturedManualItem[] configuredItems = rule.ManualListIds
            .Where(listsById.ContainsKey)
            .SelectMany(id => listsById[id].Items
                .Where(item => IsActiveAt(item.StartsAt, item.EndsAt, now))
                .OrderBy(item => item.Position))
            .DistinctBy(item => item.ItemId, StringComparer.OrdinalIgnoreCase)
            .Take(candidateLimit)
            .ToArray();
        Dictionary<Guid, BaseItem> allowedItems = GetAllowedManualItems(configuredItems);
        return configuredItems
            .Select(item => Guid.TryParse(item.ItemId, out Guid id) && allowedItems.TryGetValue(id, out BaseItem? value) ? value : null)
            .Where(item => item is not null)
            .Cast<BaseItem>()
            .ToList();
    }

    private IEnumerable<BaseItem> QueryStandardCandidates(
        FeaturedSourceRule rule,
        Jellyfin.Database.Implementations.Entities.User? queryUser,
        int candidateLimit)
    {
        InternalItemsQuery query = CreateCandidateQuery(queryUser, false);
        query.IsPlayed = rule.Type == FeaturedSourceTypes.Unplayed ? false : null;
        if (rule.Type == FeaturedSourceTypes.Libraries)
        {
            query.AncestorIds = rule.LibraryIds
                .Select(value => Guid.TryParse(value, out Guid id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToArray();
        }

        if (rule.Type == FeaturedSourceTypes.Tags && rule.Tags.Length > 0)
        {
            query.Tags = rule.Tags;
        }

        query.OrderBy = rule.Type switch
        {
            FeaturedSourceTypes.RecentlyAdded => [(ItemSortBy.DateCreated, SortOrder.Descending)],
            FeaturedSourceTypes.LatestReleases => [(ItemSortBy.PremiereDate, SortOrder.Descending)],
            _ => [(ItemSortBy.Random, SortOrder.Ascending)]
        };
        query.Limit = candidateLimit;
        return _libraryManager.GetItemList(query);
    }

    private IEnumerable<BaseItem> GetFavouriteCandidates(
        FeaturedSourceRule rule,
        int candidateLimit)
    {
        if (!Guid.TryParse(rule.EditorUserId, out Guid editorUserId)) return [];
        Jellyfin.Database.Implementations.Entities.User? editorUser = _userManager.GetUserById(editorUserId);
        if (editorUser == null) return [];

        InternalItemsQuery query = CreateCandidateQuery(editorUser, true);
        query.IsFavorite = true;
        query.IncludeItemsByName = true;
        query.OrderBy = new[] { (ItemSortBy.Random, SortOrder.Ascending) };
        query.Limit = candidateLimit;
        return _libraryManager.GetItemList(query);
    }

    private IEnumerable<BaseItem> GetFolderCandidates(IEnumerable<string> folderIds)
    {
        List<BaseItem> result = [];
        foreach (string value in folderIds)
        {
            if (!Guid.TryParse(value, out Guid id) || _libraryManager.GetItemById(id) is not Folder folder) continue;
            result.AddRange(folder.GetRecursiveChildren());
        }

        return result;
    }

    private List<BaseItem> NormalizeAndRequery(
        IEnumerable<BaseItem> items,
        Jellyfin.Database.Implementations.Entities.User? queryUser,
        int limit,
        bool preserveEpisodes = false)
    {
        List<Guid> ids = [];
        foreach (BaseItem original in items)
        {
            BaseItem? item = original;
            if (!preserveEpisodes
                && (item is Episode or Season || item.GetBaseItemKind() is BaseItemKind.Episode or BaseItemKind.Season))
            {
                item = item.GetParent();
                if (item?.GetBaseItemKind() == BaseItemKind.Season) item = item.GetParent();
            }

            if (item != null && IsSupportedItemType(item, preserveEpisodes) && !ids.Contains(item.Id))
            {
                ids.Add(item.Id);
            }

            if (ids.Count >= limit) break;
        }

        if (ids.Count == 0) return [];
        InternalItemsQuery query = CreateCandidateQuery(queryUser, false);
        if (preserveEpisodes) query.IncludeItemTypes = [.. FeaturedMediaTypes.All, BaseItemKind.Episode];
        query.ItemIds = [.. ids];
        query.Limit = limit;
        return _libraryManager.GetItemList(query).ToList();
    }

    private static List<BaseItem> NormalizeWithoutRequery(
        IEnumerable<BaseItem> items,
        int limit)
        => items
            .Where(IsSupportedItemType)
            .DistinctBy(item => item.Id)
            .Take(limit)
            .ToList();

    private static bool IsUserScopedSource(FeaturedSourceRule rule)
        => rule.Type is FeaturedSourceTypes.Unplayed
            or FeaturedSourceTypes.Recommendations
            or FeaturedSourceTypes.ContinueWatching
            or FeaturedSourceTypes.NextUp;
}
