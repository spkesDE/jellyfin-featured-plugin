using System.Net.Mime;
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
        if (personalization.RepeatCooldownDays <= 0) return Ok(new { ok = true });
        BaseItem? item = _libraryManager.GetItemById(request.ItemId);
        if (item is null || !item.IsVisible(activeUser)) return NotFound();
        _historyStore.Record(activeUser.Id, item.Id);
        _preparedCache.RemoveDisplayedItem(activeUser.Id, item.Id);
        return Ok(new { ok = true });
    }

    private ActionResult<FeaturedItemsResponseDto> BuildItemsResponse(HashSet<Guid> excludedIds)
    {
        try
        {
            Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
            if (activeUser == null)
            {
                return NotFound();
            }

            int requestedCount = _config.EnableInfiniteLoading ? InfiniteBatchSize : _config.RandomMediaCount;
            FeaturedPersonalizationContext personalization = _personalization.Resolve(_config, activeUser.Id);
            IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory = _historyStore.GetRecentItems(activeUser.Id, personalization.RepeatCooldownDays);
            HashSet<Guid> allExcludedIds = [.. excludedIds, .. recentHistory.Keys];
            List<BaseItem> selectedItems;
            if (!_preparedCache.TryGetItems(activeUser, _config, personalization, allExcludedIds, requestedCount, out selectedItems))
            {
                selectedItems = CreateEngine().SelectItems(activeUser, excludedIds, recentHistory, requestedCount, personalization).Items;
                if (_config.EnablePreparedCache) _preparedCache.QueueUserRefresh(activeUser.Id);
            }

            List<FeaturedItemDto> items = selectedItems.Select(item => CreateItemResponse(item, activeUser)).ToList();
            return new JsonResult(
                new FeaturedItemsResponseDto(_config, items, InfiniteBatchSize, requestedCount, personalization),
                RuntimeConfigJsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build the Jellyfin Featured response.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    private FeaturedRuleEngine CreateEngine() => new(_config, _userManager, _libraryManager, _userDataManager, _candidateCache);

    private FeaturedItemDto CreateItemResponse(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        return new FeaturedItemDto
        {
            Id = item.Id.ToString(),
            Name = item.Name,
            MediaType = item.GetBaseItemKind().ToString(),
            ImageType = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop) ? "Backdrop" : "Primary",
            Tagline = item.Tagline,
            OfficialRating = item.OfficialRating,
            HasLogo = item.HasImage(MediaBrowser.Model.Entities.ImageType.Logo),
            ProductionYear = _config.ShowYear ? item.ProductionYear : null,
            RuntimeMinutes = _config.ShowRuntime && item.RunTimeTicks.HasValue
                ? (int)Math.Round(TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes)
                : null,
            Trailer = _config.EnableBackgroundTrailers ? _trailerResolver.Resolve(item, activeUser, _config) : null,
            Overview = _config.ShowDescription ? item.Overview : null,
            CriticRating = _config.ShowRating ? item.CriticRating : null,
            CommunityRating = _config.ShowRating && item.CommunityRating.HasValue
                ? Math.Round(Convert.ToDecimal(item.CommunityRating), 2)
                : null
        };
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
