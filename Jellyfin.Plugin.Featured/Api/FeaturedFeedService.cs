using System.Diagnostics;
using MediaBrowser.Controller.Entities;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

/// <summary>
/// Builds a featured feed independently of HTTP. Prepared-cache ordering is used
/// only when the configured mixer allows it; live mixing may still share candidate work.
/// </summary>
public sealed class FeaturedFeedService
{
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedDismissalStore _dismissalStore;
    private readonly FeaturedPreparedCache _preparedCache;
    private readonly FeaturedPersonalizationService _personalization;
    private readonly FeaturedItemDtoFactory _itemDtoFactory;
    private readonly FeaturedRuleEngineFactory _ruleEngineFactory;
    private readonly ILogger<FeaturedFeedService> _logger;

    public FeaturedFeedService(
        FeaturedDisplayHistoryStore historyStore,
        FeaturedDismissalStore dismissalStore,
        FeaturedPreparedCache preparedCache,
        FeaturedPersonalizationService personalization,
        FeaturedItemDtoFactory itemDtoFactory,
        FeaturedRuleEngineFactory ruleEngineFactory,
        ILogger<FeaturedFeedService> logger)
    {
        _historyStore = historyStore;
        _dismissalStore = dismissalStore;
        _preparedCache = preparedCache;
        _personalization = personalization;
        _itemDtoFactory = itemDtoFactory;
        _ruleEngineFactory = ruleEngineFactory;
        _logger = logger;
    }

    internal FeaturedFeedBuildResult Build(
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config,
        FeaturedPresetResolution presetResolution,
        HashSet<Guid> excludedIds,
        int requestedCount,
        int batchSize)
    {
        long checkpoint = Stopwatch.GetTimestamp();
        FeaturedPersonalizationContext personalization = _personalization.Resolve(config, activeUser.Id);
        double personalizationMilliseconds = Elapsed(ref checkpoint);
        FeaturedDismissalSnapshot dismissals = _dismissalStore.GetSnapshot(activeUser.Id);
        IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory =
            _historyStore.GetRecentItems(activeUser.Id, personalization.RepeatCooldownHours);
        double historyMilliseconds = Elapsed(ref checkpoint);

        HashSet<Guid> allExcludedIds = [.. excludedIds, .. recentHistory.Keys];
        bool preparedCacheHit = _preparedCache.TryGetItems(
            activeUser,
            config,
            personalization,
            allExcludedIds,
            requestedCount,
            out List<FeaturedItemDto> items,
            out string preparedCacheStatus,
            out double cachedDtoMilliseconds,
            dismissals);
        string initialPreparedCacheStatus = preparedCacheStatus;
        double preparedCacheMilliseconds = Math.Max(0, Elapsed(ref checkpoint) - cachedDtoMilliseconds);
        double ruleEngineMilliseconds = 0;
        double dtoMilliseconds = cachedDtoMilliseconds;
        FeaturedSelection? coldPool = null;

        if (!preparedCacheHit && FeaturedPreparedCache.CanPopulateFromRequest(preparedCacheStatus))
        {
            coldPool = Select(config, activeUser, [], recentHistory, FeaturedPreparedCache.GetRequestedPoolSize(config), personalization, dismissals);
            ruleEngineMilliseconds += Elapsed(ref checkpoint);
            _preparedCache.StoreRequestPool(activeUser, config, personalization, coldPool, dismissals);
            preparedCacheHit = _preparedCache.TryGetItems(
                activeUser,
                config,
                personalization,
                allExcludedIds,
                requestedCount,
                out items,
                out string coldFillStatus,
                out double coldFillDtoMilliseconds,
                dismissals);
            preparedCacheMilliseconds += Math.Max(0, Elapsed(ref checkpoint) - coldFillDtoMilliseconds);
            dtoMilliseconds += coldFillDtoMilliseconds;
            preparedCacheStatus = preparedCacheHit
                ? $"cold-filled ({initialPreparedCacheStatus})"
                : $"cold-fill failed ({initialPreparedCacheStatus}; {coldFillStatus})";
        }

        if (!preparedCacheHit)
        {
            FeaturedSelection selection = coldPool
                ?? Select(config, activeUser, excludedIds, recentHistory, requestedCount, personalization, dismissals);
            if (coldPool is null) ruleEngineMilliseconds += Elapsed(ref checkpoint);
            List<BaseItem> displayItems = selection.Items
                .Where(item => !allExcludedIds.Contains(item.Id))
                .Take(requestedCount)
                .ToList();
            items = _itemDtoFactory
                .CreateBatch(displayItems, activeUser, config, personalization, selection.ItemReasons)
                .Select(projection => projection.Dto.Value)
                .ToList();
            dtoMilliseconds += Elapsed(ref checkpoint);
            if (config.EnablePreparedCache) _preparedCache.QueueUserRefresh(activeUser.Id);
        }

        FeaturedItemsResponseDto payload = new(
            config,
            items,
            batchSize,
            requestedCount,
            personalization,
            presetResolution.ActivePresetId,
            presetResolution.ActivePresetName,
            presetResolution.NextScheduleChange);
        return new(
            payload,
            personalization,
            preparedCacheStatus,
            new FeaturedFeedTiming(
                personalizationMilliseconds,
                historyMilliseconds,
                preparedCacheMilliseconds,
                ruleEngineMilliseconds,
                dtoMilliseconds));
    }

    private FeaturedSelection Select(
        PluginConfiguration config,
        Jellyfin.Database.Implementations.Entities.User user,
        HashSet<Guid> excludedIds,
        IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory,
        int requestedCount,
        FeaturedPersonalizationContext personalization,
        FeaturedDismissalSnapshot dismissals)
    {
        FeaturedSelection selection = _ruleEngineFactory.Create(config)
            .SelectItems(user, excludedIds, recentHistory, requestedCount, personalization, dismissals);
        if (config.Debug) _logger.LogInformation("{RuleEngineTiming}", selection.Timing.FormatReport());
        return selection;
    }

    private static double Elapsed(ref long checkpoint)
    {
        long now = Stopwatch.GetTimestamp();
        double elapsed = Stopwatch.GetElapsedTime(checkpoint, now).TotalMilliseconds;
        checkpoint = now;
        return elapsed;
    }
}

internal sealed record FeaturedFeedBuildResult(
    FeaturedItemsResponseDto Payload,
    FeaturedPersonalizationContext Personalization,
    string PreparedCacheStatus,
    FeaturedFeedTiming Timing);

internal sealed record FeaturedFeedTiming(
    double PersonalizationMilliseconds,
    double HistoryMilliseconds,
    double PreparedCacheMilliseconds,
    double RuleEngineMilliseconds,
    double DtoMilliseconds);
