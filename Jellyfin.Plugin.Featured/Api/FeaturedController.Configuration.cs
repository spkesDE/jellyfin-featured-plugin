using System.Net.Mime;
using Jellyfin.Data;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("config/options")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<Dictionary<string, object>> GetConfigOptions()
    {
        try
        {
            Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
            if (activeUser == null) return NotFound();
            if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();

            InternalItemsQuery query = new(activeUser)
            {
                IncludeItemTypes = [.. FeaturedMediaTypes.All, BaseItemKind.BoxSet, BaseItemKind.Playlist]
            };
            List<BaseItem> items = _libraryManager.GetItemList(query).ToList();
            object[] collections = items
                .Where(item => item.GetBaseItemKind() == BaseItemKind.BoxSet)
                .OrderBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
                .Select(item => (object)new { id = item.Id.ToString(), name = item.Name })
                .ToArray();
            object[] playlists = items
                .Where(item => item.GetBaseItemKind() == BaseItemKind.Playlist)
                .OrderBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
                .Select(item => (object)new { id = item.Id.ToString(), name = item.Name })
                .ToArray();
            string[] genres = items
                .Where(item => FeaturedMediaTypes.Contains(item.GetBaseItemKind()))
                .SelectMany(item => item.Genres)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.CurrentCultureIgnoreCase)
                .OrderBy(value => value, StringComparer.CurrentCultureIgnoreCase)
                .ToArray();
            string[] tags = items
                .Where(item => FeaturedMediaTypes.Contains(item.GetBaseItemKind()))
                .SelectMany(item => item.Tags)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.CurrentCultureIgnoreCase)
                .OrderBy(value => value, StringComparer.CurrentCultureIgnoreCase)
                .ToArray();
            FeaturedFilterOptions filterOptions = _mediaMetadata.GetFilterOptions(
                items.Where(item => FeaturedMediaTypes.Contains(item.GetBaseItemKind())));

            return Ok(new Dictionary<string, object>
            {
                ["collections"] = collections,
                ["playlists"] = playlists,
                ["genres"] = genres,
                ["tags"] = tags,
                ["actors"] = filterOptions.Actors,
                ["directors"] = filterOptions.Directors,
                ["originalLanguages"] = filterOptions.OriginalLanguages,
                ["audioLanguages"] = filterOptions.AudioLanguages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Jellyfin Featured configuration options.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    [HttpGet("config/search")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<Dictionary<string, object>> SearchConfigItems([FromQuery] string? term)
    {
        try
        {
            Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
            string searchTerm = term?.Trim() ?? string.Empty;
            if (activeUser == null) return NotFound();
            if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();
            if (searchTerm.Length < 2) return Ok(new Dictionary<string, object> { ["items"] = Array.Empty<object>() });

            InternalItemsQuery query = new(activeUser)
            {
                IncludeItemTypes = FeaturedMediaTypes.All,
                SearchTerm = searchTerm,
                Limit = 25,
                OrderBy = [(ItemSortBy.SortName, SortOrder.Ascending)]
            };
            object[] items = _libraryManager.GetItemList(query)
                .Where(item => item.IsVisible(activeUser)
                    && (item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop)
                        || item.HasImage(MediaBrowser.Model.Entities.ImageType.Primary)))
                .Select(item => (object)new
                {
                    id = item.Id.ToString(),
                    name = item.Name,
                    mediaType = item.GetBaseItemKind().ToString(),
                    imageType = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop) ? "Backdrop" : "Primary",
                    productionYear = item.ProductionYear
                })
                .ToArray();
            return Ok(new Dictionary<string, object> { ["items"] = items });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to search Jellyfin Featured configuration items.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    [HttpPost("config/history/clear")]
    [Authorize]
    public ActionResult ClearDisplayHistory([FromBody] FeaturedClearHistoryRequest? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();
        Guid[] userIds = (request?.UserIds ?? [])
            .Where(userId => userId != Guid.Empty && _userManager.GetUserById(userId) is not null)
            .Distinct()
            .Take(100)
            .ToArray();
        if (userIds.Length == 0) return BadRequest();

        int historiesRemoved = _historyStore.Clear(userIds);
        foreach (Guid userId in userIds) _preparedCache.QueueUserRefresh(userId);
        return Ok(new { ok = true, selectedUsers = userIds.Length, historiesRemoved });
    }
}
