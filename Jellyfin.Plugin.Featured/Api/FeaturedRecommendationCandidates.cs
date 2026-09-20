using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedRecommendationCandidates
{
    private readonly ISimilarItemsManager _similarItemsManager;
    private readonly ILogger<FeaturedRecommendationCandidates> _logger;

    public FeaturedRecommendationCandidates(
        ISimilarItemsManager similarItemsManager,
        ILogger<FeaturedRecommendationCandidates> logger)
    {
        _similarItemsManager = similarItemsManager;
        _logger = logger;
    }

    internal List<BaseItem> GetMovieRecommendations(
        Jellyfin.Database.Implementations.Entities.User user,
        int candidateLimit)
    {
        try
        {
            int categoryLimit = Math.Clamp((candidateLimit + 9) / 10, 1, 12);
            return _similarItemsManager.GetMovieRecommendationsAsync(
                    user, Guid.Empty, categoryLimit, 10, new DtoOptions(), CancellationToken.None)
                .GetAwaiter().GetResult()
                .SelectMany(category => category.Items)
                .DistinctBy(item => item.Id)
                .Take(candidateLimit)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load Jellyfin movie recommendations for user {UserId}.", user.Id);
            return [];
        }
    }
}
