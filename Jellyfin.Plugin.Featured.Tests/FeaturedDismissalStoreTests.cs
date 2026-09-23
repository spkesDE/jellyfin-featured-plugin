using System.Reflection;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedDismissalStoreTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void DismissalsPersistPerUserAndCanBeUndone()
    {
        FeaturedDismissalStore store = CreateStore();
        Guid otherUserId = Guid.NewGuid();
        FeaturedDismissalEntry saved = store.Add(_user.Id, Entry(FeaturedDismissalScopes.Title, Guid.NewGuid().ToString("N"), "Movie"));

        FeaturedDismissalStore reloaded = CreateStore();

        Assert.Single(reloaded.Get(_user.Id));
        Assert.Empty(reloaded.Get(otherUserId));
        Assert.True(reloaded.Remove(_user.Id, saved.Id));
        Assert.Empty(reloaded.Get(_user.Id));
    }

    [Fact]
    public void SnapshotMatchesTitleSeriesAndFranchiseScopesIndependently()
    {
        BaseItem title = CreateItems(1)[0];
        Series series = new() { Id = Guid.NewGuid(), Name = "Series" };
        Movie franchiseMovie = (Movie)CreateItems(1)[0];
        Movie relatedMovie = (Movie)CreateItems(1)[0];
        franchiseMovie.TmdbCollectionName = "Example Saga";
        relatedMovie.TmdbCollectionName = "example saga";
        FeaturedDismissalSnapshot snapshot = new(
        [
            Entry(FeaturedDismissalScopes.Title, title.Id.ToString("N"), title.Name),
            Entry(FeaturedDismissalScopes.Series, series.Id.ToString("N"), series.Name),
            Entry(FeaturedDismissalScopes.Franchise, "Example Saga", "Example Saga")
        ]);

        Assert.True(snapshot.IsDismissed(title));
        Assert.True(snapshot.IsDismissed(series));
        Assert.True(snapshot.IsDismissed(franchiseMovie));
        Assert.True(snapshot.IsDismissed(relatedMovie));
        Assert.False(snapshot.IsDismissed(CreateItems(1)[0]));
    }

    private FeaturedDismissalStore CreateStore()
    {
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;
        return new FeaturedDismissalStore(paths, NullLogger<FeaturedDismissalStore>.Instance);
    }

    private static FeaturedDismissalEntry Entry(string scope, string key, string name) => new()
    {
        Scope = scope,
        Key = key,
        Name = name,
        ItemId = Guid.NewGuid().ToString("N")
    };
}
