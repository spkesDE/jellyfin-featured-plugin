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
    public ActionResult<FeaturedItemsResponseDto> GetItems(
        [FromQuery] string? excludeItemIds = null,
        [FromQuery] string? requestKind = null)
    {
        return BuildItemsResponse(ParseExcludedItemIds(excludeItemIds), NormalizeRequestKind(requestKind));
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
        return BuildItemsResponse(excludedIds, "batch");
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

    [HttpPost("favorites/changed")]
    [Authorize]
    public ActionResult FavoriteChanged([FromBody] FeaturedFavoriteChangedRequest? request)
        => InvalidateRecommendationCachesForChangedItem(request?.ItemId ?? Guid.Empty);

    [HttpPost("playstate/changed")]
    [Authorize]
    public ActionResult PlaystateChanged([FromBody] FeaturedPlaystateChangedRequest? request)
        => InvalidateRecommendationCachesForChangedItem(request?.ItemId ?? Guid.Empty);

    private ActionResult InvalidateRecommendationCachesForChangedItem(Guid itemId)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (itemId == Guid.Empty) return BadRequest();
        BaseItem? item = _libraryManager.GetItemById(itemId);
        if (item is null || !item.IsVisible(activeUser)) return NotFound();

        _candidateCache.RemoveUser(activeUser.Id);
        _preparedCache.RemoveUser(activeUser.Id);
        return Ok(new { ok = true });
    }

    private ActionResult<FeaturedItemsResponseDto> BuildItemsResponse(
        HashSet<Guid> excludedIds,
        string requestKind)
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

            FeaturedFeedBuildResult feed = _feedService.Build(
                activeUser,
                _config,
                _presetResolution,
                excludedIds,
                requestedCount,
                InfiniteBatchSize);
            checkpoint = Stopwatch.GetTimestamp();
            string json = JsonSerializer.Serialize(feed.Payload, RuntimeConfigJsonOptions);
            double serializationMilliseconds = GetElapsedMilliseconds(ref checkpoint);
            double totalMilliseconds = Stopwatch.GetElapsedTime(requestStarted).TotalMilliseconds;

            Response.Headers["X-Featured-Prepared-Cache"] = feed.PreparedCacheStatus;
            if (_config.Debug)
            {
                Response.Headers["Server-Timing"] = string.Join(", ",
                    FormatServerTiming("user-config", userConfigMilliseconds),
                    FormatServerTiming("personalization", feed.Timing.PersonalizationMilliseconds),
                    FormatServerTiming("history", feed.Timing.HistoryMilliseconds),
                    FormatServerTiming("prepared-cache", feed.Timing.PreparedCacheMilliseconds, feed.PreparedCacheStatus),
                    FormatServerTiming("rule-engine", feed.Timing.RuleEngineMilliseconds),
                    FormatServerTiming("dto-trailers", feed.Timing.DtoMilliseconds),
                    FormatServerTiming("serialization", serializationMilliseconds),
                    FormatServerTiming("total", totalMilliseconds));
                LogRequestTiming(
                    requestKind,
                    userConfigMilliseconds,
                    feed.Timing.PersonalizationMilliseconds,
                    feed.Timing.HistoryMilliseconds,
                    feed.Timing.PreparedCacheMilliseconds,
                    feed.PreparedCacheStatus,
                    feed.Timing.RuleEngineMilliseconds,
                    feed.Timing.DtoMilliseconds,
                    serializationMilliseconds,
                    totalMilliseconds);
            }

            if (_config.PersonalizationPolicy.Enabled && _config.PersonalizationPolicy.AllowPreferredGenres)
            {
                Response.OnCompleted(() =>
                {
                    _preferenceOptionsCache.QueueWarmup(activeUser.Id, () => QueryVisibleGenres(activeUser));
                    return Task.CompletedTask;
                });
            }

            return Content(json, MediaTypeNames.Application.Json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build the Jellyfin Featured response.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private FeaturedRuleEngine CreateEngine(PluginConfiguration? config = null)
        => _ruleEngineFactory.Create(config ?? _config);

    internal static void WarmItemsResponseSerialization(
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization)
    {
        FeaturedItemDto placeholder = new()
        {
            Id = string.Empty,
            Name = string.Empty,
            MediaType = string.Empty,
            ImageType = string.Empty,
            HasImage = false,
            HasLogo = false
        };
        _ = JsonSerializer.Serialize(
            new FeaturedItemsResponseDto(config, [placeholder], InfiniteBatchSize, 1, personalization, null, null, null),
            RuntimeConfigJsonOptions);
    }

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
        string requestKind,
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
            Featured request timing ({requestKind.ToUpperInvariant()})
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

    private static string NormalizeRequestKind(string? value)
        => string.Equals(value, "remount", StringComparison.OrdinalIgnoreCase) ? "remount" : "initial";
}
