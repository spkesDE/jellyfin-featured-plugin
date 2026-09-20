using System.Reflection;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedRecommendationCandidatesTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void MovieRecommendationCandidatesKeepProviderOrderAndRemoveDuplicates()
    {
        List<BaseItem> movies = CreateItems(2);
        ISimilarItemsManager manager = DispatchProxy.Create<ISimilarItemsManager, SimilarItemsManagerStub>();
        ((SimilarItemsManagerStub)manager).Recommendations =
        [
            new MediaBrowser.Controller.Library.SimilarItemsRecommendation
            {
                BaselineItemName = "Watched movie",
                CategoryId = Guid.NewGuid(),
                RecommendationType = MediaBrowser.Model.Dto.RecommendationType.SimilarToRecentlyPlayed,
                Items = [movies[0], movies[1], movies[0]]
            }
        ];
        FeaturedRecommendationCandidates candidates = new(manager, NullLogger<FeaturedRecommendationCandidates>.Instance);

        Assert.Equal(movies.Select(movie => movie.Id),
            candidates.GetMovieRecommendations(_user, 10).Select(movie => movie.Id));
    }
}
