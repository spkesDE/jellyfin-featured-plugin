using System.Net.Mime;
using Jellyfin.Data.Enums;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("dismissals")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedDismissalsResponse> GetDismissals()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        return new JsonResult(
            new FeaturedDismissalsResponse(_config.DismissalPolicy, _dismissalStore.Get(activeUser.Id)),
            RuntimeConfigJsonOptions);
    }

    [HttpPost("dismissals")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedDismissalMutationResponse> Dismiss([FromBody] FeaturedDismissalRequest? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (!_config.DismissalPolicy.Enabled) return Forbid();
        if (request is null || request.ItemId == Guid.Empty) return BadRequest();

        BaseItem? item = _libraryManager.GetItemById(request.ItemId);
        if (item is null || !item.IsVisibleStandalone(activeUser)) return NotFound();
        FeaturedDismissalEntry? entry = CreateDismissalEntry(item, request.Scope);
        if (entry is null) return BadRequest();

        FeaturedDismissalEntry saved = _dismissalStore.Add(activeUser.Id, entry);
        InvalidateDismissalCache(activeUser.Id);
        return new JsonResult(new FeaturedDismissalMutationResponse { Dismissal = saved }, RuntimeConfigJsonOptions);
    }

    [HttpPost("dismissals/undo")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedDismissalsResponse> UndoDismissal([FromBody] FeaturedDismissalUndoRequest? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (request is null || string.IsNullOrWhiteSpace(request.DismissalId)) return BadRequest();
        if (!_dismissalStore.Remove(activeUser.Id, request.DismissalId)) return NotFound();
        InvalidateDismissalCache(activeUser.Id);
        return new JsonResult(
            new FeaturedDismissalsResponse(_config.DismissalPolicy, _dismissalStore.Get(activeUser.Id)),
            RuntimeConfigJsonOptions);
    }

    [HttpPost("dismissals/reset")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedDismissalsResponse> ResetDismissals()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        _dismissalStore.Clear(activeUser.Id);
        InvalidateDismissalCache(activeUser.Id);
        return new JsonResult(
            new FeaturedDismissalsResponse(_config.DismissalPolicy, []),
            RuntimeConfigJsonOptions);
    }

    private FeaturedDismissalEntry? CreateDismissalEntry(BaseItem item, string? requestedScope)
    {
        string scope = requestedScope?.Trim().ToLowerInvariant() ?? string.Empty;
        return scope switch
        {
            FeaturedDismissalScopes.Title when _config.DismissalPolicy.AllowTitle => NewDismissal(
                scope, item.Id.ToString("N"), item.Name, item.Id),
            FeaturedDismissalScopes.Series when _config.DismissalPolicy.AllowSeries
                && item.GetBaseItemKind() == BaseItemKind.Series => NewDismissal(
                    scope, item.Id.ToString("N"), item.Name, item.Id),
            FeaturedDismissalScopes.Franchise when _config.DismissalPolicy.AllowFranchise
                && item is Movie movie && !string.IsNullOrWhiteSpace(movie.TmdbCollectionName) => NewDismissal(
                    scope, movie.TmdbCollectionName.Trim(), movie.TmdbCollectionName.Trim(), item.Id),
            _ => null
        };
    }

    private static FeaturedDismissalEntry NewDismissal(string scope, string key, string name, Guid itemId) => new()
    {
        Scope = scope,
        Key = key,
        Name = name,
        ItemId = itemId.ToString("N"),
        DismissedAt = DateTimeOffset.UtcNow
    };

    private void InvalidateDismissalCache(Guid userId)
    {
        _preparedCache.RemoveUser(userId);
        _preparedCache.QueueUserRefresh(userId);
    }
}
