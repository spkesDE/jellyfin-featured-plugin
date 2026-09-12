using System.Net.Mime;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jellyfin.Data;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

[ApiController]
[Route("featured")]
public sealed class FeaturedController : ControllerBase
{
    private const int InfiniteBatchSize = 5;
    private const int MaximumExcludedItemIds = 500;
    private const string ScriptResourcePath = "Jellyfin.Plugin.Featured.dist.featured.bundle.js";
    private const string ConfigScriptResourcePath = "Jellyfin.Plugin.Featured.dist.config.bundle.js";
    private static readonly JsonSerializerOptions RuntimeConfigJsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Lazy<byte[]> ClientScript = new(
        () => LoadEmbeddedScript(ScriptResourcePath),
        LazyThreadSafetyMode.ExecutionAndPublication);
    private static readonly Lazy<ScriptAsset> ConfigScript = new(
        () => CreateScriptAsset(LoadEmbeddedScript(ConfigScriptResourcePath)),
        LazyThreadSafetyMode.ExecutionAndPublication);
    private static readonly object RuntimeScriptSync = new();
    private static string? CachedRuntimeConfiguration;
    private static ScriptAsset? CachedRuntimeScript;
    private readonly PluginConfiguration _config;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedCandidateCache _candidateCache;
    private readonly FeaturedPreparedCache _preparedCache;
    private readonly FeaturedPersonalizationService _personalization;
    private readonly ILogger<FeaturedController> _logger;

    public FeaturedController(
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        FeaturedDisplayHistoryStore historyStore,
        FeaturedCandidateCache candidateCache,
        FeaturedPreparedCache preparedCache,
        FeaturedPersonalizationService personalization,
        ILogger<FeaturedController> logger)
    {
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _historyStore = historyStore;
        _candidateCache = candidateCache;
        _preparedCache = preparedCache;
        _personalization = personalization;
        _logger = logger;
        _config = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
    }

    [HttpGet("script")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        try
        {
            string serializedConfig = JsonSerializer.Serialize(
                CreateRuntimeConfiguration(),
                RuntimeConfigJsonOptions);
            return ServeScript(GetOrCreateRuntimeScript(serializedConfig));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not load the embedded Jellyfin Featured client bundle.");
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "The Jellyfin Featured client bundle is invalid.");
        }
    }

    private FeaturedRuntimeConfigurationDto CreateRuntimeConfiguration() => new(_config);

    [HttpGet("config-script")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [Produces("application/javascript")]
    public ActionResult GetConfigScript()
    {
        try
        {
            return ServeScript(ConfigScript.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not load the embedded Jellyfin Featured configuration bundle.");
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "The Jellyfin Featured configuration bundle is invalid.");
        }
    }

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

            return Ok(new Dictionary<string, object>
            {
                ["collections"] = collections,
                ["playlists"] = playlists,
                ["genres"] = genres,
                ["tags"] = tags
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Jellyfin Featured configuration options.");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    [HttpGet("preferences")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferencesResponse> GetPreferences()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        return Ok(CreatePreferencesResponse(activeUser));
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
        return Ok(CreatePreferencesResponse(activeUser));
    }

    [HttpGet("preferences/options")]
    [Authorize]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<FeaturedPreferenceOptionsResponse> GetPreferenceOptions()
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser == null) return NotFound();
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, activeUser.Id);
        FeaturedPreferenceSourceOption[] sources = effective.SourceRules.Select(rule => new FeaturedPreferenceSourceOption
        {
            Id = rule.Id,
            Type = rule.Type,
            Enabled = rule.Enabled,
            Weight = rule.Weight
        }).ToArray();
        return Ok(new FeaturedPreferenceOptionsResponse(_config.PersonalizationPolicy, sources, GetVisibleGenres(activeUser)));
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
            HashSet<Guid> historyExcludedIds = _historyStore.GetRecentItemIds(activeUser.Id, personalization.RepeatCooldownDays);
            FeaturedSelection selection = CreateEngine().SelectItems(activeUser, [], historyExcludedIds, requestedCount, personalization);
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
                ["sources"] = _config.SourceRules.Where(rule => rule.Enabled).Select(rule => rule.Type).ToArray(),
                ["matchingItems"] = selection.RuleStats.Sum(stat => stat.AfterFilters),
                ["eligibleItems"] = selection.RuleStats.Sum(stat => stat.Eligible),
                ["heroItemsReturned"] = selection.Items.Count,
                ["manualListsActive"] = _config.ManualLists.Count(list =>
                    referencedManualListIds.Contains(list.Id)
                    && list.Enabled
                    && (!list.StartsAt.HasValue || list.StartsAt <= now)
                    && (!list.EndsAt.HasValue || list.EndsAt > now)),
                ["userProfileApplied"] = selection.UserProfileApplied,
                ["repeatCooldownDays"] = personalization.RepeatCooldownDays,
                ["historyEntries"] = _historyStore.GetEntryCount(activeUser.Id),
                ["rules"] = selection.RuleStats.Select(stat => new Dictionary<string, object>
                {
                    ["id"] = stat.Id,
                    ["type"] = stat.Type,
                    ["candidateItems"] = stat.CandidateItems,
                    ["filteredOut"] = stat.FilteredOut,
                    ["afterFilters"] = stat.AfterFilters,
                    ["ineligible"] = stat.Ineligible,
                    ["eligible"] = stat.Eligible,
                    ["allocated"] = stat.Allocated,
                    ["duplicates"] = stat.Duplicates,
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
            HashSet<Guid> historyExcludedIds = _historyStore.GetRecentItemIds(activeUser.Id, personalization.RepeatCooldownDays);
            HashSet<Guid> allExcludedIds = [.. excludedIds, .. historyExcludedIds];
            List<BaseItem> selectedItems;
            if (!_preparedCache.TryGetItems(activeUser, _config, personalization, allExcludedIds, requestedCount, out selectedItems))
            {
                selectedItems = CreateEngine().SelectItems(activeUser, excludedIds, historyExcludedIds, requestedCount, personalization).Items;
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

    private FeaturedPreferencesResponse CreatePreferencesResponse(Jellyfin.Database.Implementations.Entities.User user)
    {
        FeaturedPersonalizationContext effective = _personalization.Resolve(_config, user.Id);
        FeaturedPersonalizationContext defaults = _personalization.ResolveDefaults(_config, user.Id);
        return new FeaturedPreferencesResponse(_personalization.Get(user.Id), effective, defaults);
    }

    private string[] GetVisibleGenres(Jellyfin.Database.Implementations.Entities.User user)
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

    private FeaturedItemDto CreateItemResponse(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        BaseItem? trailer = null;
        if (_config.EnableBackgroundTrailers && item is IHasTrailers itemWithTrailers)
        {
            trailer = itemWithTrailers.LocalTrailers.FirstOrDefault(candidate => candidate.IsVisible(activeUser));
        }

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
            LocalTrailerId = trailer?.Id.ToString(),
            Overview = _config.ShowDescription ? item.Overview : null,
            CriticRating = _config.ShowRating ? item.CriticRating : null,
            CommunityRating = _config.ShowRating && item.CommunityRating.HasValue
                ? Math.Round(Convert.ToDecimal(item.CommunityRating), 2)
                : null
        };
    }

    private Jellyfin.Database.Implementations.Entities.User? GetActiveUser()
    {
        string? name = User.Identity?.Name;
        return string.IsNullOrWhiteSpace(name) ? null : _userManager.GetUserByName(name);
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

    private ActionResult ServeScript(ScriptAsset asset)
    {
        if (_config.Debug)
        {
            Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
            Response.Headers.Pragma = "no-cache";
            Response.Headers.Expires = "0";
            return File(asset.Content, "application/javascript; charset=utf-8");
        }

        Response.Headers.CacheControl = "private, no-cache";
        Response.Headers.ETag = asset.ETag;
        string requestedTags = Request.Headers.IfNoneMatch.ToString();
        if (requestedTags.Split(',').Any(tag => string.Equals(tag.Trim(), asset.ETag, StringComparison.Ordinal)))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(asset.Content, "application/javascript; charset=utf-8");
    }

    private static ScriptAsset GetOrCreateRuntimeScript(string serializedConfig)
    {
        lock (RuntimeScriptSync)
        {
            if (CachedRuntimeScript is not null
                && string.Equals(CachedRuntimeConfiguration, serializedConfig, StringComparison.Ordinal))
            {
                return CachedRuntimeScript;
            }

            byte[] configBytes = Encoding.UTF8.GetBytes(
                "window.JellyfinFeaturedPluginConfig = " + serializedConfig + ";" + Environment.NewLine);
            byte[] scriptBytes = ClientScript.Value;
            byte[] result = new byte[configBytes.Length + scriptBytes.Length];
            Buffer.BlockCopy(configBytes, 0, result, 0, configBytes.Length);
            Buffer.BlockCopy(scriptBytes, 0, result, configBytes.Length, scriptBytes.Length);
            CachedRuntimeConfiguration = serializedConfig;
            CachedRuntimeScript = CreateScriptAsset(result);
            return CachedRuntimeScript;
        }
    }

    private static ScriptAsset CreateScriptAsset(byte[] content)
        => new(content, $"\"{Convert.ToHexString(SHA256.HashData(content))}\"");

    private static byte[] LoadEmbeddedScript(string resourcePath)
    {
        using Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourcePath);
        if (stream is null) throw new InvalidDataException($"Embedded resource '{resourcePath}' was not found.");
        using MemoryStream buffer = new();
        stream.CopyTo(buffer);
        byte[] script = buffer.ToArray();
        if (script.Length == 0) throw new InvalidDataException($"Embedded resource '{resourcePath}' is empty.");
        return script;
    }

    private sealed record ScriptAsset(byte[] Content, string ETag);
}

public sealed class FeaturedBatchRequest
{
    public Guid[] ExcludedItemIds { get; set; } = [];
}

public sealed class FeaturedDisplayedRequest
{
    public Guid ItemId { get; set; }
}

public sealed class FeaturedClearHistoryRequest
{
    public Guid[] UserIds { get; set; } = [];
}
