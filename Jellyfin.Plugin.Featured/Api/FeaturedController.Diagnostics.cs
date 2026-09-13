using System.Net.Mime;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("diagnostics")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<Dictionary<string, object>> GetDiagnostics()
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
            IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory = _historyStore.GetRecentItems(activeUser.Id, personalization.RepeatCooldownHours);
            FeaturedSelection selection = CreateEngine().SelectItems(activeUser, [], recentHistory, requestedCount, personalization);
            LogRuleEngineTiming(selection.Timing);
            DateTimeOffset now = DateTimeOffset.UtcNow;
            HashSet<string> referencedManualListIds = _config.SourceRules
                .Where(rule => rule.Enabled && rule.Type == FeaturedSourceTypes.ManualLists)
                .SelectMany(rule => rule.ManualListIds)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            return Ok(new Dictionary<string, object>
            {
                ["frontendInjection"] = FrontendRegistration.LastRegistrationSucceeded,
                ["frontendInjectionMethod"] = FrontendRegistration.ActiveMethod,
                ["jellyfinVersion"] = typeof(ILibraryManager).Assembly.GetName().Version?.ToString() ?? "unknown",
                ["pluginVersion"] = Plugin.Instance?.Version.ToString() ?? "unknown",
                ["currentUser"] = activeUser.Username,
                ["activePresetId"] = _presetResolution.ActivePresetId ?? string.Empty,
                ["activePresetName"] = _presetResolution.ActivePresetName ?? "Default",
                ["nextPresetChange"] = _presetResolution.NextScheduleChange?.ToString("O") ?? string.Empty,
                ["sources"] = personalization.SourceRules.Where(rule => rule.Enabled).Select(rule => rule.Type).ToArray(),
                ["matchingItems"] = selection.RuleStats.Sum(stat => stat.AfterFilters),
                ["eligibleItems"] = selection.RuleStats.Sum(stat => stat.Eligible),
                ["heroItemsReturned"] = selection.Items.Count,
                ["manualListsActive"] = _config.ManualLists.Count(list =>
                    referencedManualListIds.Contains(list.Id)
                    && list.Enabled
                    && (!list.StartsAt.HasValue || list.StartsAt <= now)
                    && (!list.EndsAt.HasValue || list.EndsAt > now)),
                ["userProfileApplied"] = selection.UserProfileApplied,
                ["repeatCooldownDays"] = personalization.RepeatCooldownHours / 24d,
                ["repeatCooldownHours"] = personalization.RepeatCooldownHours,
                ["historyEntries"] = _historyStore.GetEntryCount(activeUser.Id),
                ["rules"] = selection.RuleStats.Select(stat => new Dictionary<string, object>
                {
                    ["id"] = stat.Id,
                    ["type"] = stat.Type,
                    ["candidateItems"] = stat.CandidateItems,
                    ["filteredOut"] = stat.FilteredOut,
                    ["afterFilters"] = stat.AfterFilters,
                    ["ineligible"] = stat.Ineligible,
                    ["cooldownExcluded"] = stat.CooldownExcluded,
                    ["eligible"] = stat.Eligible,
                    ["allocated"] = stat.Allocated,
                    ["duplicates"] = stat.Duplicates,
                    ["diversitySkipped"] = stat.DiversitySkipped,
                    ["cooldownRelaxed"] = stat.CooldownRelaxed,
                    ["fallback"] = stat.IsFallback,
                    ["returned"] = stat.Returned
                }).ToArray(),
                ["basePath"] = string.IsNullOrEmpty(Request.PathBase.Value) ? "/" : Request.PathBase.Value,
                ["cache"] = $"{_preparedCache.GetStatus()}; {_candidateCache.GetStatus()}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build the Jellyfin Featured diagnostics response.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
