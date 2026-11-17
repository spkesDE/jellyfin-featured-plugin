using System.Reflection;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedStatisticsStoreTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void CountsImpressionsOpensAndPlaysAndPersistsThem()
    {
        Guid itemId = Guid.NewGuid();
        using (FeaturedStatisticsStore store = CreateStore())
        {
            store.RecordImpression(itemId);
            store.RecordImpression(itemId);
            Assert.True(store.RecordInteraction(itemId, "open"));
            Assert.True(store.RecordInteraction(itemId, "PLAY"));
            Assert.False(store.RecordInteraction(itemId, "hover"));
        }

        using FeaturedStatisticsStore reloaded = CreateStore();
        FeaturedItemStatistics stats = reloaded.GetSnapshot().Items[itemId.ToString("N")];
        Assert.Equal(2, stats.Impressions);
        Assert.Equal(1, stats.Opens);
        Assert.Equal(1, stats.Plays);
        Assert.NotNull(stats.LastShownAt);
    }

    [Fact]
    public void ResetStartsANewPeriod()
    {
        using FeaturedStatisticsStore store = CreateStore();
        store.RecordImpression(Guid.NewGuid());
        DateTimeOffset before = store.GetSnapshot().Since;

        store.Reset();

        Assert.Empty(store.GetSnapshot().Items);
        Assert.True(store.GetSnapshot().Since >= before);
    }

    [Fact]
    public void KeepsTheNumberOfTrackedTitlesBounded()
    {
        using FeaturedStatisticsStore store = CreateStore();
        for (int index = 0; index <= FeaturedStatisticsStore.MaximumItems; index++) store.RecordImpression(Guid.NewGuid());

        Assert.True(store.GetSnapshot().Items.Count <= FeaturedStatisticsStore.MaximumItems);
    }

    private FeaturedStatisticsStore CreateStore()
    {
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;
        return new FeaturedStatisticsStore(paths, NullLogger<FeaturedStatisticsStore>.Instance);
    }
}
