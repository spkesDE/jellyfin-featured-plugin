using System.Diagnostics;
using Jellyfin.Data.Enums;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed partial class FeaturedRuleEngine
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
        IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory,
        int requestedCount,
        FeaturedPersonalizationContext? personalization = null)
    {
        long totalStarted = Stopwatch.GetTimestamp();
        long phaseStarted = totalStarted;
        List<FeaturedRuleDiagnostic> diagnostics = [];
        List<BaseItem> result = [];
        Dictionary<Guid, FeaturedItemSelectionReason> itemReasons = [];
        HashSet<string> selectedKeys = new(StringComparer.OrdinalIgnoreCase);
        FeaturedDiversityTracker diversity = new(_config);
        FeaturedUserProfile? profile = personalization?.Profile ?? _config.UserProfiles.FirstOrDefault(candidate =>
            candidate.Enabled
            && Guid.TryParse(candidate.UserId, out Guid userId)
            && userId == activeUser.Id);
        string[] excludedGenres = personalization?.ExcludedGenres ?? [];

        List<(FeaturedSourceRule Rule, List<BaseItem> Items)> candidatesByRule = (personalization?.SourceRules ?? _config.SourceRules)
            .Where(rule => rule.Enabled)
            .Select(rule => (rule, GetSourceCandidates(rule, activeUser, requestedCount)))
            .ToList();
        List<BaseItem> distinctCandidates = candidatesByRule
            .SelectMany(candidateSet => candidateSet.Items)
            .DistinctBy(item => item.Id)
            .ToList();
        double sourceCandidatesMilliseconds = ElapsedMilliseconds(phaseStarted);

        phaseStarted = Stopwatch.GetTimestamp();
        HashSet<Guid> allowedItemIds = FeaturedUserAccess.GetAllowedItemIds(distinctCandidates, activeUser);
        double allowedItemsAccessMilliseconds = ElapsedMilliseconds(phaseStarted);

        phaseStarted = Stopwatch.GetTimestamp();
        bool needsUserData = profile is not null
            || _config.GlobalFilters.Any(filter => filter.Field == FeaturedFilterFields.Played)
            || candidatesByRule.Any(candidateSet =>
                candidateSet.Rule.Filters.Any(filter => filter.Field == FeaturedFilterFields.Played));
        IReadOnlyDictionary<Guid, UserItemData>? selectionUserData = needsUserData
            ? _userDataManager.GetUserDataBatch(
                distinctCandidates.Where(item => allowedItemIds.Contains(item.Id)).ToList(),
                activeUser)
            : null;
        double userDataBatchMilliseconds = ElapsedMilliseconds(phaseStarted);

        phaseStarted = Stopwatch.GetTimestamp();
        HashSet<Guid>? globallyFilteredItemIds = _config.GlobalFilters.Length == 0
            ? null
            : distinctCandidates
                .Where(item => MatchesAllFilters(item, _config.GlobalFilters, selectionUserData))
                .Select(item => item.Id)
                .ToHashSet();
        double globalFiltersMilliseconds = ElapsedMilliseconds(phaseStarted);

        List<FeaturedRulePool> pools = [];
        double ruleFiltersMilliseconds = 0;
        double personalizationScoringMilliseconds = 0;
        for (int index = 0; index < candidatesByRule.Count; index++)
        {
            phaseStarted = Stopwatch.GetTimestamp();
            FeaturedSourceRule rule = candidatesByRule[index].Rule;
            List<BaseItem> candidates = candidatesByRule[index].Items;
            List<BaseItem> afterFilters = candidates
                .Where(item => globallyFilteredItemIds is null || globallyFilteredItemIds.Contains(item.Id))
                .Where(item => MatchesAllFilters(item, rule.Filters, selectionUserData))
                .Where(item => excludedGenres.Length == 0 || !ContainsAny(item.Genres, excludedGenres))
                .ToList();
            List<BaseItem> eligibleBeforeCooldown = afterFilters
                .Where(item => IsEligibleItem(item, allowedItemIds, requestExcludedIds))
                .DistinctBy(item => item.Id)
                .ToList();
            List<BaseItem> eligible = eligibleBeforeCooldown
                .Where(item => !recentHistory.ContainsKey(item.Id))
                .ToList();
            List<BaseItem> cooldownEligible = _config.RelaxRepeatCooldownWhenNeeded
                ? eligibleBeforeCooldown
                    .Where(item => recentHistory.ContainsKey(item.Id))
                    .OrderBy(item => recentHistory[item.Id])
                    .ToList()
                : [];
            ruleFiltersMilliseconds += ElapsedMilliseconds(phaseStarted);

            phaseStarted = Stopwatch.GetTimestamp();
            if (rule.Type != FeaturedSourceTypes.ManualLists)
            {
                eligible = OrderForProfile(eligible, profile, selectionUserData);
                cooldownEligible = OrderForProfile(cooldownEligible, profile, selectionUserData)
                    .OrderBy(item => recentHistory[item.Id])
                    .ToList();
            }
            personalizationScoringMilliseconds += ElapsedMilliseconds(phaseStarted);

            phaseStarted = Stopwatch.GetTimestamp();
            FeaturedRuleDiagnostic stats = new()
            {
                Id = rule.Id,
                Type = rule.Type,
                CandidateItems = candidates.Count,
                FilteredOut = candidates.Count - afterFilters.Count,
                AfterFilters = afterFilters.Count,
                Ineligible = afterFilters.Count - eligibleBeforeCooldown.Count,
                CooldownExcluded = eligibleBeforeCooldown.Count - eligible.Count,
                Eligible = eligible.Count,
                IsFallback = rule.IsFallback
            };
            pools.Add(new FeaturedRulePool(index, rule, eligible, cooldownEligible, stats));
            ruleFiltersMilliseconds += ElapsedMilliseconds(phaseStarted);
        }

        phaseStarted = Stopwatch.GetTimestamp();
        List<FeaturedRulePool> primaryPools = pools.Where(pool => !pool.Rule.IsFallback).ToList();
        List<FeaturedRulePool> fallbackPools = pools.Where(pool => pool.Rule.IsFallback).ToList();
        FillFromPools(primaryPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: true);
        FillFromPools(fallbackPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: true);

        // Diversity is best-effort: never return an unnecessarily short feed.
        RestoreDeferred(primaryPools);
        FillFromPools(primaryPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: false);
        RestoreDeferred(fallbackPools);
        FillFromPools(fallbackPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: false);

        if (_config.RelaxRepeatCooldownWhenNeeded && result.Count < requestedCount)
        {
            ActivateCooldownItems(primaryPools);
            FillFromPools(primaryPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: true, cooldownRelaxed: true);
            ActivateCooldownItems(fallbackPools);
            FillFromPools(fallbackPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: true, cooldownRelaxed: true);
            RestoreDeferred(primaryPools);
            FillFromPools(primaryPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: false, cooldownRelaxed: true);
            RestoreDeferred(fallbackPools);
            FillFromPools(fallbackPools, requestedCount, result, selectedKeys, diversity, itemReasons, enforceDiversity: false, cooldownRelaxed: true);
        }

        diagnostics.AddRange(pools.Select(pool => pool.Stats));
        double poolAllocationMilliseconds = ElapsedMilliseconds(phaseStarted);
        FeaturedRuleEngineTiming timing = new(
            sourceCandidatesMilliseconds,
            allowedItemsAccessMilliseconds,
            userDataBatchMilliseconds,
            globalFiltersMilliseconds,
            ruleFiltersMilliseconds,
            personalizationScoringMilliseconds,
            poolAllocationMilliseconds,
            ElapsedMilliseconds(totalStarted));
        return new FeaturedSelection(result, diagnostics, profile is not null, timing, itemReasons);
    }

    private static double ElapsedMilliseconds(long started)
        => Stopwatch.GetElapsedTime(started).TotalMilliseconds;

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

}
