using System.Diagnostics;
using System.Net.Mime;
using MediaBrowser.Controller.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("preferences")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesResponse> GetPreferences([FromQuery] Guid? userId = null)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetPreferencesUser(userId, out ActionResult? error);
        if (activeUser == null) return error!;
        return new JsonResult(CreatePreferencesResponse(activeUser), RuntimeConfigJsonOptions);
    }

    [HttpPut("preferences")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesResponse> PutPreferences([FromBody] FeaturedPreferencesUpdate? request, [FromQuery] Guid? userId = null)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetPreferencesUser(userId, out ActionResult? error);
        if (activeUser == null) return error!;
        if (!_config.PersonalizationPolicy.Enabled && !_config.DismissalPolicy.Enabled) return Forbid();
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

    /// <summary>Remembers the signed-in user's trailer mute state and volume without re-preparing their feed.</summary>
    [HttpPut("preferences/trailer-audio")]
    [Authorize]
    public ActionResult PutTrailerAudio([FromBody] FeaturedTrailerAudioUpdate? request)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        if (request is null || (!request.Muted.HasValue && !request.Volume.HasValue)) return BadRequest();
        if (!FeaturedPersonalizationService.CanRememberTrailerAudio(_config)) return Forbid();
        // With automatic saving off, the player keeps changes for the session and the saved values stay the defaults.
        if (!_personalization.Resolve(_config, activeUser.Id).Display.AutoSaveTrailerAudio) return Forbid();
        _personalization.SetTrailerAudio(activeUser.Id, request.Muted, request.Volume);
        return Ok(new { ok = true });
    }

    [HttpGet("preferences/options")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferenceOptionsResponse> GetPreferenceOptions([FromQuery] Guid? userId = null)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetPreferencesUser(userId, out ActionResult? error);
        if (activeUser == null) return error!;
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, activeUser.Id);
        return new JsonResult(CreatePreferenceOptionsResponse(activeUser, effective), RuntimeConfigJsonOptions);
    }

    [HttpGet("preferences/bootstrap")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesBootstrapResponse> GetPreferencesBootstrap([FromQuery] Guid? userId = null)
    {
        Stopwatch totalTimer = Stopwatch.StartNew();
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetPreferencesUser(userId, out ActionResult? error);
        if (activeUser == null) return error!;

        Stopwatch stageTimer = Stopwatch.StartNew();
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, activeUser.Id);
        FeaturedPersonalizationContext defaults = _personalization.ResolveDefaults(_config, activeUser.Id);
        FeaturedPreferencesResponse current = new(_personalization.Get(activeUser.Id), effective, defaults);
        double preferencesMilliseconds = stageTimer.Elapsed.TotalMilliseconds;
        _logger.LogDebug(
            "Jellyfin Featured user-settings bootstrap resolved preferences in {ElapsedMilliseconds:F1} ms.",
            preferencesMilliseconds);

        stageTimer.Restart();
        FeaturedPreferenceOptionsResponse options = CreatePreferenceOptionsResponse(activeUser, effective);
        double optionsMilliseconds = stageTimer.Elapsed.TotalMilliseconds;
        _logger.LogDebug(
            "Jellyfin Featured user-settings bootstrap built options in {ElapsedMilliseconds:F1} ms ({SourceCount} sources, {GenreCount} genres).",
            optionsMilliseconds,
            options.Sources.Length,
            options.Genres.Length);
        _logger.LogInformation(
            "Jellyfin Featured user-settings bootstrap completed in {ElapsedMilliseconds:F1} ms (preferences {PreferencesMilliseconds:F1} ms, options {OptionsMilliseconds:F1} ms).",
            totalTimer.Elapsed.TotalMilliseconds,
            preferencesMilliseconds,
            optionsMilliseconds);
        FeaturedDismissalsResponse dismissals = new(_config.DismissalPolicy, _dismissalStore.Get(activeUser.Id));
        return new JsonResult(new FeaturedPreferencesBootstrapResponse(current, options, dismissals), RuntimeConfigJsonOptions);
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
            Name = rule.Name,
            Enabled = rule.Enabled,
            Weight = rule.Weight
        }).ToArray();
        return new FeaturedPreferenceOptionsResponse(_config.PersonalizationPolicy, sources, GetVisibleGenres(user));
    }

    private string[] QueryVisibleGenres(Jellyfin.Database.Implementations.Entities.User user)
    {
        Stopwatch timer = Stopwatch.StartNew();
        string[] genres = FeaturedGenreOptions.Query(_libraryManager, user);
        _logger.LogInformation(
            "Jellyfin Featured user-settings genre lookup found {GenreCount} genres in {ElapsedMilliseconds:F1} ms.",
            genres.Length,
            timer.Elapsed.TotalMilliseconds);
        return genres;
    }
}
