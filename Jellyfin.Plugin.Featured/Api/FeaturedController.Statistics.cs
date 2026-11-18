using System.Net.Mime;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    private const int MaximumStatisticsRows = 500;

    [HttpPost("items/interaction")]
    [Authorize]
    public ActionResult RecordInteraction(
        [FromBody] FeaturedInteractionRequest? request,
        [FromServices] FeaturedStatisticsStore statistics)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (request is null || request.ItemId == Guid.Empty) return BadRequest();
        if (!_config.EnableStatistics) return Ok(new { ok = true });
        BaseItem? item = _libraryManager.GetItemById(request.ItemId);
        if (item is null || !item.IsVisibleStandalone(activeUser)) return NotFound();
        return statistics.RecordInteraction(item.Id, request.Kind) ? Ok(new { ok = true }) : BadRequest();
    }

    [HttpGet("statistics")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedStatisticsResponse> GetStatistics(
        [FromServices] FeaturedStatisticsStore statistics,
        [FromQuery] int limit = 100,
        [FromQuery] int days = 30)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();

        FeaturedStatisticsSnapshot snapshot = statistics.GetSnapshot();
        FeaturedStatisticsRow[] rows = snapshot.Items
            .Select(pair => (Id: Guid.TryParse(pair.Key, out Guid id) ? id : Guid.Empty, Stats: pair.Value))
            .Where(entry => entry.Id != Guid.Empty)
            .OrderByDescending(entry => entry.Stats.Impressions)
            .ThenByDescending(entry => entry.Stats.Opens + entry.Stats.Plays)
            .Take(Math.Clamp(limit, 1, MaximumStatisticsRows))
            .Select(entry =>
            {
                BaseItem? item = _libraryManager.GetItemById(entry.Id);
                return new FeaturedStatisticsRow
                {
                    Id = entry.Id.ToString("N"),
                    Name = item?.Name,
                    Type = item?.GetBaseItemKind().ToString(),
                    Impressions = entry.Stats.Impressions,
                    Opens = entry.Stats.Opens,
                    Plays = entry.Stats.Plays,
                    LastShownAt = entry.Stats.LastShownAt
                };
            })
            .ToArray();
        return new JsonResult(
            new FeaturedStatisticsResponse
            {
                Enabled = _config.EnableStatistics,
                Since = snapshot.Since,
                TrackedItems = snapshot.Items.Count,
                TotalImpressions = snapshot.Items.Values.Sum(entry => entry.Impressions),
                TotalOpens = snapshot.Items.Values.Sum(entry => entry.Opens),
                TotalPlays = snapshot.Items.Values.Sum(entry => entry.Plays),
                Days = statistics.GetDailyTotals(Math.Clamp(days, 7, FeaturedStatisticsStore.RetainedDays)),
                Items = rows
            },
            RuntimeConfigJsonOptions);
    }

    [HttpPost("statistics/reset")]
    [Authorize]
    public ActionResult ResetStatistics([FromServices] FeaturedStatisticsStore statistics)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();
        statistics.Reset();
        return Ok(new { ok = true });
    }
}

public sealed class FeaturedInteractionRequest
{
    public Guid ItemId { get; set; }

    public string Kind { get; set; } = FeaturedInteractionKinds.Open;
}

public sealed class FeaturedStatisticsResponse
{
    public bool Enabled { get; init; }

    public DateTimeOffset Since { get; init; }

    public int TrackedItems { get; init; }

    public long TotalImpressions { get; init; }

    public long TotalOpens { get; init; }

    public long TotalPlays { get; init; }

    public FeaturedDailyStatistics[] Days { get; init; } = [];

    public FeaturedStatisticsRow[] Items { get; init; } = [];
}

public sealed class FeaturedStatisticsRow
{
    public string Id { get; init; } = string.Empty;

    /// <summary>Null when the title was removed from the library since it was shown.</summary>
    public string? Name { get; init; }

    public string? Type { get; init; }

    public long Impressions { get; init; }

    public long Opens { get; init; }

    public long Plays { get; init; }

    public DateTimeOffset? LastShownAt { get; init; }
}
