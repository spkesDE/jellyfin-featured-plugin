using System.Text.Json;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

[ApiController]
[Route("featured")]
public sealed partial class FeaturedController : ControllerBase
{
    private static readonly JsonSerializerOptions RuntimeConfigJsonOptions = new(JsonSerializerDefaults.Web);
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













    private Jellyfin.Database.Implementations.Entities.User? GetActiveUser()
    {
        string? name = User.Identity?.Name;
        return string.IsNullOrWhiteSpace(name) ? null : _userManager.GetUserByName(name);
    }
}
