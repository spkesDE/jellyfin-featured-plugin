using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedRuleEngineFactory
{
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly FeaturedCandidateCache _candidateCache;
    private readonly FeaturedRecommendationCandidates _recommendations;
    private readonly FeaturedMediaMetadataService _mediaMetadata;

    public FeaturedRuleEngineFactory(
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        FeaturedCandidateCache candidateCache,
        FeaturedRecommendationCandidates recommendations,
        FeaturedMediaMetadataService mediaMetadata)
    {
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _candidateCache = candidateCache;
        _recommendations = recommendations;
        _mediaMetadata = mediaMetadata;
    }

    internal FeaturedRuleEngine Create(PluginConfiguration config)
        => new(config, _userManager, _libraryManager, _userDataManager, _candidateCache, _recommendations, _mediaMetadata);
}
