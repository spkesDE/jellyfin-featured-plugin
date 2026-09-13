using System.Net.Mime;
using MediaBrowser.Controller.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("preferences")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesResponse> GetPreferences()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        return new JsonResult(CreatePreferencesResponse(activeUser), RuntimeConfigJsonOptions);
    }

    [HttpPut("preferences")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesResponse> PutPreferences([FromBody] FeaturedPreferencesUpdate? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        if (!_config.PersonalizationPolicy.Enabled) return Forbid();
        if (request?.Reset == true)
        {
            _personalization.Remove(activeUser.Id);
        }
        else if (request?.Preferences is not null)
        {
            HashSet<string> genres = GetVisibleGenres(activeUser).ToHashSet(StringComparer.OrdinalIgnoreCase);
            _personalization.NormalizeAndSave(_config, activeUser.Id, request.Preferences, genres);
        }
        else
        {
            return BadRequest();
        }

        _preparedCache.QueueUserRefresh(activeUser.Id);
        return new JsonResult(CreatePreferencesResponse(activeUser), RuntimeConfigJsonOptions);
    }

    [HttpGet("preferences/options")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferenceOptionsResponse> GetPreferenceOptions()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, activeUser.Id);
        return new JsonResult(CreatePreferenceOptionsResponse(activeUser, effective), RuntimeConfigJsonOptions);
    }

    [HttpGet("preferences/bootstrap")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesBootstrapResponse> GetPreferencesBootstrap()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, activeUser.Id);
        FeaturedPersonalizationContext defaults = _personalization.ResolveDefaults(_config, activeUser.Id);
        FeaturedPreferencesResponse current = new(_personalization.Get(activeUser.Id), effective, defaults);
        FeaturedPreferenceOptionsResponse options = CreatePreferenceOptionsResponse(activeUser, effective);
        return new JsonResult(new FeaturedPreferencesBootstrapResponse(current, options), RuntimeConfigJsonOptions);
    }

    private FeaturedPreferencesResponse CreatePreferencesResponse(Jellyfin.Database.Implementations.Entities.User user)
    {
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, user.Id);
        FeaturedPersonalizationContext defaults = _personalization.ResolveDefaults(_config, user.Id);
        return new FeaturedPreferencesResponse(_personalization.Get(user.Id), effective, defaults);
    }

    private string[] GetVisibleGenres(Jellyfin.Database.Implementations.Entities.User user)
    {
        return _preferenceOptionsCache.GetOrCreate(user.Id, () => QueryVisibleGenres(user));
    }

    private FeaturedPreferenceOptionsResponse CreatePreferenceOptionsResponse(
        Jellyfin.Database.Implementations.Entities.User user,
        FeaturedPersonalizationContext effective)
    {
        FeaturedPreferenceSourceOption[] sources = effective.SourceRules.Select(rule => new FeaturedPreferenceSourceOption
        {
            Id = rule.Id,
            Type = rule.Type,
            Enabled = rule.Enabled,
            Weight = rule.Weight
        }).ToArray();
        return new FeaturedPreferenceOptionsResponse(_config.PersonalizationPolicy, sources, GetVisibleGenres(user));
    }

    private string[] QueryVisibleGenres(Jellyfin.Database.Implementations.Entities.User user)
    {
        InternalItemsQuery query = new(user) { IncludeItemTypes = FeaturedMediaTypes.All };
        return _libraryManager.GetItemList(query)
            .Where(item => item.IsVisible(user))
            .SelectMany(item => item.Genres)
            .Where(genre => !string.IsNullOrWhiteSpace(genre))
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(genre => genre, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }
}
