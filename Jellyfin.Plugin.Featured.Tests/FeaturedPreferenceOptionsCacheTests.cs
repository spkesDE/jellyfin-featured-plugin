using Jellyfin.Plugin.Featured.Api;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedPreferenceOptionsCacheTests
{
    [Fact]
    public void GetOrCreateCachesPerUserAndReturnsDefensiveCopies()
    {
        using MemoryCache memoryCache = new(new MemoryCacheOptions());
        FeaturedPreferenceOptionsCache cache = new(memoryCache, NullLogger<FeaturedPreferenceOptionsCache>.Instance);
        Guid userId = Guid.NewGuid();
        int loads = 0;

        string[] first = cache.GetOrCreate(userId, () =>
        {
            loads += 1;
            return ["Drama"];
        });
        first[0] = "Changed";
        string[] second = cache.GetOrCreate(userId, () => throw new InvalidOperationException("The cached value should win."));

        Assert.Equal(1, loads);
        Assert.Equal(["Drama"], second);
    }

    [Fact]
    public void FailedFactoriesAreEvicted()
    {
        using MemoryCache memoryCache = new(new MemoryCacheOptions());
        FeaturedPreferenceOptionsCache cache = new(memoryCache, NullLogger<FeaturedPreferenceOptionsCache>.Instance);
        Guid userId = Guid.NewGuid();

        Assert.Throws<InvalidOperationException>(() => cache.GetOrCreate(userId, () => throw new InvalidOperationException()));
        Assert.Equal(["Comedy"], cache.GetOrCreate(userId, () => ["Comedy"]));
    }
}
