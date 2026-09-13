using System.Diagnostics;
using System.Net.Mime;
using System.Text.Json;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    private const int InfiniteBatchSize = 5;
    private const int MaximumExcludedItemIds = 500;

    [HttpGet("items")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedItemsResponseDto> GetItems([FromQuery] string? excludeItemIds = null)
    {
        return BuildItemsResponse(ParseExcludedItemIds(excludeItemIds));
    }

    [HttpPost("items/batch")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedItemsResponseDto> GetItemsBatch([FromBody] FeaturedBatchRequest? request)
    {
        HashSet<Guid> excludedIds = (request?.ExcludedItemIds ?? [])
            .Where(id => id != Guid.Empty)
            .Take(MaximumExcludedItemIds)
            .ToHashSet();
        return BuildItemsResponse(excludedIds);
    }

    [HttpPost("items/displayed")]
    [Authorize]
    public ActionResult RecordDisplayedItem([FromBody] FeaturedDisplayedRequest? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        if (request is null || request.ItemId == Guid.Empty) return BadRequest();
        FeaturedPersonalizationContext personalization = _personalization.Resolve(_config, activeUser.Id);
        if (personalization.RepeatCooldownHours <= 0) return Ok(new { ok = true });
        BaseItem? item = _libraryManager.GetItemById(request.ItemId);
        if (item is null || !item.IsVisible(activeUser)) return NotFound();
        _historyStore.Record(activeUser.Id, item.Id);
        _preparedCache.RemoveDisplayedItem(activeUser.Id, item.Id);
        return Ok(new { ok = true });
    }

    private ActionResult<FeaturedItemsResponseDto> BuildItemsResponse(HashSet<Guid> excludedIds)
    {
        long requestStarted = Stopwatch.GetTimestamp();
        long checkpoint = requestStarted;
        try
        {
            Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
            if (activeUser == null)
            {
                return NotFound();
            }

            int requestedCount = _config.EnableInfiniteLoading ? InfiniteBatchSize : _config.RandomMediaCount;
            double userConfigMilliseconds = GetElapsedMilliseconds(ref checkpoint);

            FeaturedPersonalizationContext personalization = _personalization.Resolve(_config, activeUser.Id);
            double personalizationMilliseconds = GetElapsedMilliseconds(ref checkpoint);

            IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory = _historyStore.GetRecentItems(activeUser.Id, personalization.RepeatCooldownHours);
            double historyMilliseconds = GetElapsedMilliseconds(ref checkpoint);

            HashSet<Guid> allExcludedIds = [.. excludedIds, .. recentHistory.Keys];
            List<FeaturedItemDto> items;
            bool preparedCacheHit = _preparedCache.TryGetItems(
                activeUser,
                _config,
                personalization,
                allExcludedIds,
                requestedCount,
                out items,
                out string preparedCacheStatus,
                out double cachedDtoMilliseconds);
            double preparedCacheMilliseconds = Math.Max(0, GetElapsedMilliseconds(ref checkpoint) - cachedDtoMilliseconds);

            double ruleEngineMilliseconds = 0;
            double dtoMilliseconds = cachedDtoMilliseconds;
            IReadOnlyList<BaseItem>? coldPoolItems = null;
            if (!preparedCacheHit && FeaturedPreparedCache.CanPopulateFromRequest(preparedCacheStatus))
            {
                FeaturedSelection coldPool = CreateEngine().SelectItems(
                    activeUser,
                    [],
                    recentHistory,
                    FeaturedPreparedCache.GetRequestedPoolSize(_config),
                    personalization);
                LogRuleEngineTiming(coldPool.Timing);
                coldPoolItems = coldPool.Items;
                ruleEngineMilliseconds += GetElapsedMilliseconds(ref checkpoint);
                _preparedCache.StoreRequestPool(activeUser, _config, personalization, coldPool.Items);

                preparedCacheHit = _preparedCache.TryGetItems(
                    activeUser,
                    _config,
                    personalization,
                    allExcludedIds,
                    requestedCount,
                    out items,
                    out string coldFillStatus,
                    out double coldFillDtoMilliseconds);
                preparedCacheMilliseconds += Math.Max(0, GetElapsedMilliseconds(ref checkpoint) - coldFillDtoMilliseconds);
                dtoMilliseconds += coldFillDtoMilliseconds;
                preparedCacheStatus = preparedCacheHit ? "cold-filled" : $"cold-fill-{coldFillStatus}";
            }

            if (!preparedCacheHit)
            {
                List<BaseItem> selectedItems;
                if (coldPoolItems is not null)
                {
                    selectedItems = coldPoolItems
                        .Where(item => !allExcludedIds.Contains(item.Id))
                        .Take(requestedCount)
                        .ToList();
                }
                else
                {
                    FeaturedSelection liveSelection = CreateEngine()
                        .SelectItems(activeUser, excludedIds, recentHistory, requestedCount, personalization);
                    LogRuleEngineTiming(liveSelection.Timing);
                    selectedItems = liveSelection.Items;
                    ruleEngineMilliseconds += GetElapsedMilliseconds(ref checkpoint);
                }

                items = selectedItems.Select(item => _itemDtoFactory.Create(item, activeUser, _config)).ToList();
                dtoMilliseconds += GetElapsedMilliseconds(ref checkpoint);
                if (_config.EnablePreparedCache) _preparedCache.QueueUserRefresh(activeUser.Id);
            }

            FeaturedItemsResponseDto payload = new FeaturedItemsResponseDto(
                _config,
                items,
                InfiniteBatchSize,
                requestedCount,
                personalization,
                _presetResolution.ActivePresetId,
                _presetResolution.ActivePresetName,
                _presetResolution.NextScheduleChange);
            string json = JsonSerializer.Serialize(payload, RuntimeConfigJsonOptions);
            double serializationMilliseconds = GetElapsedMilliseconds(ref checkpoint);
            double totalMilliseconds = Stopwatch.GetElapsedTime(requestStarted).TotalMilliseconds;

            Response.Headers["X-Featured-Prepared-Cache"] = preparedCacheStatus;
            if (_config.Debug)
            {
                Response.Headers["Server-Timing"] = string.Join(", ",
                    FormatServerTiming("user-config", userConfigMilliseconds),
                    FormatServerTiming("personalization", personalizationMilliseconds),
                    FormatServerTiming("history", historyMilliseconds),
                    FormatServerTiming("prepared-cache", preparedCacheMilliseconds, preparedCacheStatus),
                    FormatServerTiming("rule-engine", ruleEngineMilliseconds),
                    FormatServerTiming("dto-trailers", dtoMilliseconds),
                    FormatServerTiming("serialization", serializationMilliseconds),
                    FormatServerTiming("total", totalMilliseconds));
                LogRequestTiming(
                    userConfigMilliseconds,
                    personalizationMilliseconds,
                    historyMilliseconds,
                    preparedCacheMilliseconds,
                    preparedCacheStatus,
                    ruleEngineMilliseconds,
                    dtoMilliseconds,
                    serializationMilliseconds,
                    totalMilliseconds);
            }

            return Content(json, MediaTypeNames.Application.Json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build the Jellyfin Featured response.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private FeaturedRuleEngine CreateEngine() => new(_config, _userManager, _libraryManager, _userDataManager, _candidateCache);

    private static double GetElapsedMilliseconds(ref long checkpoint)
    {
        long now = Stopwatch.GetTimestamp();
        double elapsed = Stopwatch.GetElapsedTime(checkpoint, now).TotalMilliseconds;
        checkpoint = now;
        return elapsed;
    }

    private static string FormatServerTiming(string name, double milliseconds, string? description = null)
        => description is null
            ? FormattableString.Invariant($"{name};dur={milliseconds:0.###}")
            : FormattableString.Invariant($"{name};dur={milliseconds:0.###};desc=\"{description}\"");

    private void LogRequestTiming(
        double userConfig,
        double personalization,
        double history,
        double preparedCache,
        string preparedCacheStatus,
        double ruleEngine,
        double dtoTrailers,
        double serialization,
        double total)
    {
        string report = FormattableString.Invariant($"""
            Featured request timing
            -----------------------
            user/config       {userConfig,8:0.0} ms
            personalization   {personalization,8:0.0} ms
            history           {history,8:0.0} ms
            prepared cache    {preparedCache,8:0.0} ms  {preparedCacheStatus.ToUpperInvariant()}
            rule engine       {ruleEngine,8:0.0} ms
            DTO/trailers      {dtoTrailers,8:0.0} ms
            serialization     {serialization,8:0.0} ms
            -----------------------
            total             {total,8:0.0} ms
            """);
        _logger.LogInformation("{FeaturedRequestTiming}", report);
    }

    private void LogRuleEngineTiming(FeaturedRuleEngineTiming timing)
    {
        if (_config.Debug) _logger.LogInformation("{RuleEngineTiming}", timing.FormatReport());
    }

    private static HashSet<Guid> ParseExcludedItemIds(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Take(MaximumExcludedItemIds)
                .Select(candidate => Guid.TryParse(candidate, out Guid id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToHashSet();
    }
}
