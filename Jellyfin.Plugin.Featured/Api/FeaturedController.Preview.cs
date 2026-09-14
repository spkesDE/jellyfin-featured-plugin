using System.Net.Mime;
using System.Text.Json;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpPost("config/preview")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedFeedPreviewResponse> PreviewFeed([FromBody] FeaturedFeedPreviewRequest? request)
    {
        try
        {
            Jellyfin.Database.Implementations.Entities.User? administrator = GetActiveUser();
            if (administrator is null) return NotFound();
            if (!administrator.HasPermission(PermissionKind.IsAdministrator)) return Forbid();
            if (request?.Configuration is null) return BadRequest();

            Jellyfin.Database.Implementations.Entities.User? previewUser = request.UserId.HasValue
                ? _userManager.GetUserById(request.UserId.Value)
                : administrator;
            if (previewUser is null) return BadRequest();

            PluginConfiguration baseConfig = PluginConfigurationNormalizer.Normalize(request.Configuration);
            FeaturedPresetResolution resolution;
            try
            {
                resolution = FeaturedPresetResolver.ResolvePreview(
                    baseConfig,
                    DateTimeOffset.UtcNow,
                    request.PresetId,
                    request.UseDefaultConfiguration);
            }
            catch (ArgumentException)
            {
                return BadRequest();
            }

            PluginConfiguration effective = resolution.Configuration;
            int requestedCount = effective.EnableInfiniteLoading ? InfiniteBatchSize : effective.RandomMediaCount;
            FeaturedPersonalizationContext personalization = _personalization.Resolve(effective, previewUser.Id);
            IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory = _historyStore.GetRecentItems(
                previewUser.Id,
                personalization.RepeatCooldownHours);
            FeaturedSelection selection = CreateEngine(effective).SelectItems(
                previewUser,
                [],
                recentHistory,
                requestedCount,
                personalization);
            LogRuleEngineTiming(selection.Timing);

            FeaturedFeedPreviewItem[] items = selection.Items.Select(item =>
            {
                selection.ItemReasons.TryGetValue(item.Id, out FeaturedItemSelectionReason? reason);
                return new FeaturedFeedPreviewItem
                {
                    Id = item.Id.ToString(),
                    Name = item.Name,
                    MediaType = item.GetBaseItemKind().ToString(),
                    ProductionYear = item.ProductionYear,
                    SourceId = reason?.RuleId ?? string.Empty,
                    SourceType = reason?.SourceType ?? string.Empty
                };
            }).ToArray();

            FeaturedFeedPreviewResponse payload = new()
            {
                UserId = previewUser.Id.ToString(),
                UserName = previewUser.Username,
                ActivePresetId = resolution.ActivePresetId,
                ActivePresetName = resolution.ActivePresetName,
                NextPresetChange = resolution.NextScheduleChange,
                Items = items,
                Rules = selection.RuleStats,
                DuplicatesRemoved = selection.RuleStats.Sum(rule => rule.Duplicates),
                CooldownExcluded = selection.RuleStats.Sum(rule => rule.CooldownExcluded),
                DiversitySkipped = selection.RuleStats.Sum(rule => rule.DiversitySkipped),
                UserProfileApplied = selection.UserProfileApplied
            };
            return Content(
                JsonSerializer.Serialize(payload, RuntimeConfigJsonOptions),
                MediaTypeNames.Application.Json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to preview the Jellyfin Featured feed.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
