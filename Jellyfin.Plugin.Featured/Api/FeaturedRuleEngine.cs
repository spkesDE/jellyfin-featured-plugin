using System.Globalization;
using System.Text.Json;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed class FeaturedRuleEngine
{
    private const int MaximumCandidatesPerRule = 2000;
    private readonly PluginConfiguration _config;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly FeaturedCandidateCache _candidateCache;

    internal FeaturedRuleEngine(
        PluginConfiguration config,
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        FeaturedCandidateCache candidateCache)
    {
        _config = config;
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _candidateCache = candidateCache;
    }

    internal FeaturedSelection SelectItems(
        Jellyfin.Database.Implementations.Entities.User activeUser,
        HashSet<Guid> requestExcludedIds,
        HashSet<Guid> historyExcludedIds,
        int requestedCount)
    {
        List<FeaturedRuleDiagnostic> diagnostics = [];
        List<BaseItem> result = [];
        HashSet<Guid> selectedIds = [];
        HashSet<Guid> excludedIds = [.. requestExcludedIds, .. historyExcludedIds];
        FeaturedUserProfile? profile = _config.UserProfiles.FirstOrDefault(candidate =>
            candidate.Enabled
            && Guid.TryParse(candidate.UserId, out Guid userId)
            && userId == activeUser.Id);

        List<(FeaturedSourceRule Rule, List<BaseItem> Items)> candidatesByRule = _config.SourceRules
            .Where(rule => rule.Enabled)
            .Select(rule => (rule, GetSourceCandidates(rule, activeUser, requestedCount)))
            .ToList();
        List<BaseItem> distinctCandidates = candidatesByRule
            .SelectMany(candidateSet => candidateSet.Items)
            .DistinctBy(item => item.Id)
            .ToList();
        HashSet<Guid> allowedItemIds = GetAllowedItemIds(distinctCandidates, activeUser);
        bool needsUserData = profile is not null
            || _config.GlobalFilters.Any(filter => filter.Field == FeaturedFilterFields.Played)
            || candidatesByRule.Any(candidateSet =>
                candidateSet.Rule.Filters.Any(filter => filter.Field == FeaturedFilterFields.Played));
        IReadOnlyDictionary<Guid, UserItemData>? selectionUserData = needsUserData
            ? _userDataManager.GetUserDataBatch(
                distinctCandidates.Where(item => allowedItemIds.Contains(item.Id)).ToList(),
                activeUser)
            : null;
        HashSet<Guid>? globallyFilteredItemIds = _config.GlobalFilters.Length == 0
            ? null
            : distinctCandidates
                .Where(item => MatchesAllFilters(item, _config.GlobalFilters, selectionUserData))
                .Select(item => item.Id)
                .ToHashSet();

        List<FeaturedRulePool> pools = [];
        for (int index = 0; index < candidatesByRule.Count; index++)
        {
            FeaturedSourceRule rule = candidatesByRule[index].Rule;
            List<BaseItem> candidates = candidatesByRule[index].Items;
            List<BaseItem> afterFilters = candidates
                .Where(item => globallyFilteredItemIds is null || globallyFilteredItemIds.Contains(item.Id))
                .Where(item => MatchesAllFilters(item, rule.Filters, selectionUserData))
                .ToList();
            List<BaseItem> eligible = afterFilters
                .Where(item => IsEligibleItem(item, activeUser, allowedItemIds, excludedIds))
                .DistinctBy(item => item.Id)
                .ToList();
            if (rule.Type != FeaturedSourceTypes.ManualLists)
            {
                eligible = OrderForProfile(eligible, profile, selectionUserData);
            }

            FeaturedRuleDiagnostic stats = new()
            {
                Id = rule.Id,
                Type = rule.Type,
                CandidateItems = candidates.Count,
                FilteredOut = candidates.Count - afterFilters.Count,
                AfterFilters = afterFilters.Count,
                Ineligible = afterFilters.Count - eligible.Count,
                Eligible = eligible.Count
            };
            pools.Add(new FeaturedRulePool(index, rule.Weight, new Queue<BaseItem>(eligible), stats));
        }

        AllocateQuotas(pools, Math.Max(0, requestedCount - result.Count));
        while (result.Count < requestedCount && pools.Any(pool => pool.Items.Count > 0 && pool.Stats.Returned < pool.Quota))
        {
            FeaturedRulePool? pool = pools
                .Where(candidate => candidate.Items.Count > 0 && candidate.Stats.Returned < candidate.Quota)
                .OrderBy(candidate => (double)(candidate.Stats.Returned + 1) / Math.Max(1, candidate.Quota))
                .ThenBy(candidate => candidate.Index)
                .FirstOrDefault();
            if (pool == null) break;

            AddNextFromPool(pool, result, selectedIds);
        }

        // Empty or duplicate-heavy pools donate their unused quota to all remaining pools.
        while (result.Count < requestedCount)
        {
            FeaturedRulePool? pool = pools
                .Where(candidate => candidate.Items.Count > 0)
                .OrderBy(candidate => (double)(candidate.Stats.Returned + 1) / candidate.Weight)
                .ThenBy(candidate => candidate.Index)
                .FirstOrDefault();
            if (pool == null) break;

            AddNextFromPool(pool, result, selectedIds);
        }

        diagnostics.AddRange(pools.Select(pool => pool.Stats));
        return new FeaturedSelection(result, diagnostics, profile is not null);
    }

    private HashSet<Guid> GetAllowedItemIds(
        IEnumerable<BaseItem> candidates,
        Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        Guid[] itemIds = candidates.Select(item => item.Id).Distinct().ToArray();
        if (itemIds.Length == 0) return [];

        InternalItemsQuery query = CreateCandidateQuery(activeUser, false);
        query.ItemIds = itemIds;
        query.Limit = itemIds.Length;
        return _libraryManager.GetItemList(query).Select(item => item.Id).ToHashSet();
    }

    private Dictionary<Guid, BaseItem> GetAllowedManualItems(
        IEnumerable<FeaturedManualItem> configuredItems)
    {
        Guid[] ids = configuredItems
            .Select(item => Guid.TryParse(item.ItemId, out Guid id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();
        if (ids.Length == 0) return [];
        InternalItemsQuery query = CreateCandidateQuery(null, false);
        query.ItemIds = ids;
        query.Limit = ids.Length;
        return _libraryManager.GetItemList(query).ToDictionary(item => item.Id);
    }

    private static bool IsActiveAt(DateTimeOffset? startsAt, DateTimeOffset? endsAt, DateTimeOffset now)
        => (!startsAt.HasValue || startsAt <= now) && (!endsAt.HasValue || endsAt > now);

    private static void AllocateQuotas(List<FeaturedRulePool> pools, int requestedCount)
    {
        if (requestedCount <= 0 || pools.Count == 0) return;
        int totalWeight = pools.Sum(pool => pool.Weight);
        foreach (FeaturedRulePool pool in pools)
        {
            double exact = (double)requestedCount * pool.Weight / totalWeight;
            pool.Quota = (int)Math.Floor(exact);
            pool.Remainder = exact - pool.Quota;
        }

        int remaining = requestedCount - pools.Sum(pool => pool.Quota);
        foreach (FeaturedRulePool pool in pools.OrderByDescending(pool => pool.Remainder).ThenBy(pool => pool.Index).Take(remaining))
        {
            pool.Quota += 1;
        }

        foreach (FeaturedRulePool pool in pools) pool.Stats.Allocated = pool.Quota;
    }

    private static void AddNextFromPool(
        FeaturedRulePool pool,
        List<BaseItem> result,
        HashSet<Guid> selectedIds)
    {
        BaseItem item = pool.Items.Dequeue();
        if (!selectedIds.Add(item.Id))
        {
            pool.Stats.Duplicates += 1;
            return;
        }

        result.Add(item);
        pool.Stats.Returned += 1;
    }

    private List<BaseItem> OrderForProfile(
        List<BaseItem> items,
        FeaturedUserProfile? profile,
        IReadOnlyDictionary<Guid, UserItemData>? userDataById)
    {
        if (profile is null) return items.OrderBy(_ => Random.Shared.Next()).ToList();
        return items
            .Select(item =>
            {
                UserItemData? data = null;
                userDataById?.TryGetValue(item.Id, out data);
                return new { Item = item, Score = GetProfileScore(item, data, profile) };
            })
            .OrderByDescending(candidate => candidate.Score)
            .ThenBy(_ => Random.Shared.Next())
            .Select(candidate => candidate.Item)
            .ToList();
    }

    private static int GetProfileScore(BaseItem item, UserItemData? data, FeaturedUserProfile profile)
    {
        int score = 0;
        if (data?.Played != true) score += profile.UnplayedBoost;
        if (data?.IsFavorite == true) score += profile.FavouriteBoost;
        if (profile.PreferredGenres.Length > 0 && ContainsAny(item.Genres, profile.PreferredGenres))
        {
            score += profile.PreferredGenreBoost;
        }

        if (item.GetBaseItemKind() == BaseItemKind.Series
            && data?.Played != true
            && (data?.PlaybackPositionTicks > 0 || data?.PlayCount > 0 || data?.LastPlayedDate.HasValue == true))
        {
            score += profile.InProgressSeriesBoost;
        }

        return score;
    }

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
            _ => QueryStandardCandidates(rule, userScoped ? activeUser : null, candidateLimit)
        };

        List<BaseItem> normalized = NormalizeAndRequery(candidates, userScoped ? activeUser : null, candidateLimit);
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
        int limit)
    {
        List<Guid> ids = [];
        foreach (BaseItem original in items)
        {
            BaseItem? item = original;
            if (item is Episode or Season || item.GetBaseItemKind() is BaseItemKind.Episode or BaseItemKind.Season)
            {
                item = item.GetParent();
                if (item?.GetBaseItemKind() == BaseItemKind.Season) item = item.GetParent();
            }

            if (item != null && IsSupportedItemType(item) && !ids.Contains(item.Id))
            {
                ids.Add(item.Id);
            }

            if (ids.Count >= limit) break;
        }

        if (ids.Count == 0) return [];
        InternalItemsQuery query = CreateCandidateQuery(queryUser, false);
        query.ItemIds = [.. ids];
        query.Limit = limit;
        return _libraryManager.GetItemList(query).ToList();
    }

    private InternalItemsQuery CreateCandidateQuery(
        Jellyfin.Database.Implementations.Entities.User? user,
        bool includeNestedItems)
    {
        InternalItemsQuery query = user is null ? new InternalItemsQuery() : new InternalItemsQuery(user);
        query.IncludeItemTypes = includeNestedItems
            ? [.. FeaturedMediaTypes.All, BaseItemKind.Episode, BaseItemKind.Season]
            : FeaturedMediaTypes.All;
        if (user is not null)
        {
            query.MaxParentalRating = GetParentalRatingScore(user, out bool? mustHaveParentRating);
            query.HasParentalRating = mustHaveParentRating;
        }
        else if (_config.MaximumParentRating >= 0)
        {
            query.MaxParentalRating = new MediaBrowser.Model.Entities.ParentalRatingScore(
                _config.MaximumParentRating,
                _config.MaximumParentRatingSubscore);
            query.HasParentalRating = true;
        }

        return query;
    }

    private static bool IsUserScopedSource(FeaturedSourceRule rule)
        => rule.Type == FeaturedSourceTypes.Unplayed;

    private bool MatchesAllFilters(
        BaseItem item,
        IEnumerable<FeaturedFilterRule> filters,
        IReadOnlyDictionary<Guid, UserItemData>? userDataById)
    {
        return filters.All(filter => MatchesFilter(item, filter, userDataById));
    }

    private static bool MatchesFilter(
        BaseItem item,
        FeaturedFilterRule filter,
        IReadOnlyDictionary<Guid, UserItemData>? userDataById)
    {
        if (filter.Values.Length == 0) return true;
        return filter.Field switch
        {
            FeaturedFilterFields.Library => MatchBoolean(IsInAnyLibrary(item, filter.Values), filter.Operator),
            FeaturedFilterFields.Genre => MatchCollection(item.Genres, filter.Values, filter.Operator),
            FeaturedFilterFields.Tag => MatchCollection(item.Tags, filter.Values, filter.Operator),
            FeaturedFilterFields.MediaType => MatchCollection([item.GetBaseItemKind().ToString()], filter.Values, filter.Operator),
            FeaturedFilterFields.Played => MatchBoolean(
                GetPlayed(item.Id, userDataById) == ParseBoolean(filter.Values[0]),
                filter.Operator),
            FeaturedFilterFields.CommunityRating => MatchNumber(item.CommunityRating, filter.Values[0], filter.Operator),
            FeaturedFilterFields.CriticRating => MatchNumber(item.CriticRating, filter.Values[0], filter.Operator),
            FeaturedFilterFields.ProductionYear => MatchNumber(item.ProductionYear, filter.Values[0], filter.Operator),
            FeaturedFilterFields.RuntimeMinutes => MatchNumber(
                item.RunTimeTicks.HasValue ? TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes : null,
                filter.Values[0],
                filter.Operator),
            _ => true
        };
    }

    private static bool MatchCollection(IEnumerable<string> actualValues, IEnumerable<string> expectedValues, string filterOperator)
    {
        HashSet<string> actual = actualValues.ToHashSet(StringComparer.OrdinalIgnoreCase);
        string[] expected = expectedValues.ToArray();
        bool any = expected.Any(actual.Contains);
        return filterOperator switch
        {
            FeaturedFilterOperators.NotEquals => !any,
            FeaturedFilterOperators.ContainsAll => expected.All(actual.Contains),
            _ => any
        };
    }

    private static bool MatchNumber(double? actual, string expectedValue, string filterOperator)
    {
        if (!actual.HasValue || !double.TryParse(expectedValue, NumberStyles.Float, CultureInfo.InvariantCulture, out double expected)) return false;
        return filterOperator switch
        {
            FeaturedFilterOperators.LessThanOrEqual => actual.Value <= expected,
            FeaturedFilterOperators.Equal => Math.Abs(actual.Value - expected) < 0.0001,
            FeaturedFilterOperators.NotEquals => Math.Abs(actual.Value - expected) >= 0.0001,
            _ => actual.Value >= expected
        };
    }

    private static bool MatchBoolean(bool equals, string filterOperator)
        => filterOperator == FeaturedFilterOperators.NotEquals ? !equals : equals;

    private static bool ParseBoolean(string value)
        => bool.TryParse(value, out bool result) && result;

    private static bool GetPlayed(Guid itemId, IReadOnlyDictionary<Guid, UserItemData>? userDataById)
        => userDataById?.TryGetValue(itemId, out UserItemData? data) == true && data.Played;

    private static bool ContainsAny(IEnumerable<string> actualValues, IEnumerable<string> expectedValues)
    {
        HashSet<string> actual = actualValues.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return expectedValues.Any(actual.Contains);
    }

    private static bool IsInAnyLibrary(BaseItem item, IEnumerable<string> libraryIds)
    {
        HashSet<Guid> ancestors = item.GetAncestorIds().ToHashSet();
        return libraryIds.Any(value => Guid.TryParse(value, out Guid id) && ancestors.Contains(id));
    }

    private static bool IsEligibleItem(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        HashSet<Guid> allowedItemIds,
        HashSet<Guid> excludedIds)
    {
        return allowedItemIds.Contains(item.Id)
            && item.IsVisible(activeUser)
            && !excludedIds.Contains(item.Id)
            && IsSupportedItemType(item)
            && (item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop)
                || item.HasImage(MediaBrowser.Model.Entities.ImageType.Primary));
    }

    private static bool IsSupportedItemType(BaseItem item)
        => item is not Episode
            && item is not Season
            && FeaturedMediaTypes.Contains(item.GetBaseItemKind());

    private MediaBrowser.Model.Entities.ParentalRatingScore? GetParentalRatingScore(
        Jellyfin.Database.Implementations.Entities.User activeUser,
        out bool? mustHaveParentRating)
    {
        int maximumRating = _config.MaximumParentRating == -2
            ? activeUser.MaxParentalRatingScore ?? -1
            : _config.MaximumParentRating;
        int subscore = _config.MaximumParentRating == -2 ? 0 : _config.MaximumParentRatingSubscore;
        mustHaveParentRating = maximumRating >= 0 ? true : null;
        return maximumRating >= 0
            ? new MediaBrowser.Model.Entities.ParentalRatingScore(maximumRating, subscore)
            : null;
    }
}

public sealed class FeaturedRuleDiagnostic
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int CandidateItems { get; set; }
    public int FilteredOut { get; set; }
    public int AfterFilters { get; set; }
    public int Ineligible { get; set; }
    public int Eligible { get; set; }
    public int Allocated { get; set; }
    public int Duplicates { get; set; }
    public int Returned { get; set; }
}

internal sealed record FeaturedSelection(
    List<BaseItem> Items,
    List<FeaturedRuleDiagnostic> RuleStats,
    bool UserProfileApplied);

internal sealed class FeaturedRulePool
{
    internal FeaturedRulePool(int index, int weight, Queue<BaseItem> items, FeaturedRuleDiagnostic stats)
    {
        Index = index;
        Weight = weight;
        Items = items;
        Stats = stats;
    }

    internal int Index { get; }
    internal int Weight { get; }
    internal Queue<BaseItem> Items { get; }
    internal FeaturedRuleDiagnostic Stats { get; }
    internal int Quota { get; set; }
    internal double Remainder { get; set; }
}
