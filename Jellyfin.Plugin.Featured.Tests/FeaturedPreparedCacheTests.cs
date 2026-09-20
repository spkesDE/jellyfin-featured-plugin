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

public sealed class FeaturedPreparedCacheTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public async Task RefreshAllThenSameEffectiveRequestReturnsHit()
    {
        _libraryManager.Candidates.AddRange(CreateItems(6));
        await _cache.RefreshAllAsync(new Progress<double>(), CancellationToken.None);
        PluginConfiguration requestConfig = PluginConfigurationNormalizer.Normalize(new PluginConfiguration());
        FeaturedPersonalizationContext requestPersonalization = _personalization.Resolve(requestConfig, _user.Id);

        bool hit = TryGet(requestConfig, requestPersonalization, [], 5, out List<FeaturedItemDto> items, out string status);

        Assert.True(hit);
        Assert.Equal("hit", status);
        Assert.Equal(5, items.Count);
    }

    [Fact]
    public void SameEffectiveConfigAndPersonalizationRemainValid()
    {
        PluginConfiguration storedConfig = new();
        FeaturedPersonalizationContext storedPersonalization = _personalization.Resolve(storedConfig, _user.Id);
        Store(storedConfig, storedPersonalization, CreateItems(5));
        PluginConfiguration requestConfig = new();
        FeaturedPersonalizationContext requestPersonalization = _personalization.Resolve(requestConfig, _user.Id);

        Assert.NotEqual(storedPersonalization.Profile.Id, requestPersonalization.Profile.Id);
        Assert.Equal(storedPersonalization.Fingerprint, requestPersonalization.Fingerprint);
        Assert.True(TryGet(requestConfig, requestPersonalization, [], 5, out _, out string status));
        Assert.Equal("hit", status);
    }

    [Fact]
    public void ChangedRelevantConfigurationInvalidatesEntry()
    {
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = _personalization.Resolve(config, _user.Id);
        Store(config, personalization, CreateItems(5));
        config.ShowDescription = !config.ShowDescription;

        Assert.False(TryGet(config, personalization, [], 5, out _, out string status));
        Assert.Equal("miss (fingerprint mismatch)", status);
    }

    [Fact]
    public void ChangedPersonalizationInvalidatesEntry()
    {
        PluginConfiguration config = new();
        FeaturedPersonalizationContext stored = CreatePersonalization(unplayedBoost: 25);
        Store(config, stored, CreateItems(5));
        FeaturedPersonalizationContext changed = CreatePersonalization(unplayedBoost: 50);

        Assert.False(TryGet(config, changed, [], 5, out _, out string status));
        Assert.Equal("miss (fingerprint mismatch)", status);
    }

    [Fact]
    public void ExcludedItemsAreNotReturned()
    {
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = CreatePersonalization();
        List<BaseItem> source = CreateItems(5);
        Store(config, personalization, source);

        Assert.True(TryGet(config, personalization, [source[0].Id, source[1].Id], 3, out List<FeaturedItemDto> items, out string status));
        Assert.Equal("hit", status);
        Assert.DoesNotContain(items, item => item.Id == source[0].Id.ToString() || item.Id == source[1].Id.ToString());
    }

    [Fact]
    public void InsufficientEligibleItemsFallsBackSafely()
    {
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = CreatePersonalization();
        List<BaseItem> source = CreateItems(3);
        Store(config, personalization, source);

        Assert.False(TryGet(config, personalization, [source[0].Id], 3, out List<FeaturedItemDto> items, out string status));
        Assert.Empty(items);
        Assert.Equal("miss (eligible 2 < requested 3)", status);
    }

    [Fact]
    public void LiveMixingConfigurationBypassesPreparedEntry()
    {
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = CreatePersonalization();
        Store(config, personalization, CreateItems(5));
        config.MaximumItemsPerGenre = 1;

        Assert.False(TryGet(config, personalization, [], 5, out _, out string status));
        Assert.Equal("bypass (live mixing required)", status);
    }
}
