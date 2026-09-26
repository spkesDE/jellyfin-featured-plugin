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
    private readonly FeaturedPresetResolution _presetResolution;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedDismissalStore _dismissalStore;
    private readonly FeaturedCandidateCache _candidateCache;
    private readonly FeaturedMediaMetadataService _mediaMetadata;
    private readonly FeaturedPreparedCache _preparedCache;
    private readonly FeaturedPersonalizationService _personalization;
    private readonly FeaturedPreferenceOptionsCache _preferenceOptionsCache;
    private readonly FeaturedRuleEngineFactory _ruleEngineFactory;
    private readonly FeaturedFeedService _feedService;
    private readonly FrontendInjectionAvailabilityService _frontendInjectionAvailability;
    private readonly ILogger<FeaturedController> _logger;

    public FeaturedController(
        IUserManager userManager,
        ILibraryManager libraryManager,
        FeaturedDisplayHistoryStore historyStore,
        FeaturedDismissalStore dismissalStore,
        FeaturedCandidateCache candidateCache,
        FeaturedMediaMetadataService mediaMetadata,
        FeaturedPreparedCache preparedCache,
        FeaturedPersonalizationService personalization,
        FeaturedPreferenceOptionsCache preferenceOptionsCache,
        FeaturedRuleEngineFactory ruleEngineFactory,
        FeaturedFeedService feedService,
        FrontendInjectionAvailabilityService frontendInjectionAvailability,
        ILogger<FeaturedController> logger)
    {
        _userManager = userManager;
        _libraryManager = libraryManager;
        _historyStore = historyStore;
        _dismissalStore = dismissalStore;
        _candidateCache = candidateCache;
        _mediaMetadata = mediaMetadata;
        _preparedCache = preparedCache;
        _personalization = personalization;
        _preferenceOptionsCache = preferenceOptionsCache;
        _ruleEngineFactory = ruleEngineFactory;
        _feedService = feedService;
        _frontendInjectionAvailability = frontendInjectionAvailability;
        _logger = logger;
        PluginConfiguration baseConfig = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
        _presetResolution = FeaturedPresetResolver.Resolve(baseConfig, DateTimeOffset.UtcNow);
        _config = _presetResolution.Configuration;
    }



    private Jellyfin.Database.Implementations.Entities.User? GetActiveUser()
    {
        string? name = User.Identity?.Name;
        return string.IsNullOrWhiteSpace(name) ? null : _userManager.GetUserByName(name);
    }
}
