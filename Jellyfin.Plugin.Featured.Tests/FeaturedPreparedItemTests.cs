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

public sealed class FeaturedPreparedItemTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void PreparedItemsRespectContributingSourceTrailerSetting()
    {
        List<BaseItem> source = CreateItems(2);
        PluginConfiguration config = new()
        {
            EnableBackgroundTrailers = true,
            TrailerSourcePriority = FeaturedTrailerSourcePriorities.RemoteOnly,
            TrailerOverrides = source.Select(item => new FeaturedTrailerOverride
            {
                ItemId = item.Id.ToString(),
                Url = "https://www.youtube.com/watch?v=example12345"
            }).ToArray()
        };
        FeaturedPersonalizationContext personalization = new(
            [new FeaturedSourceRule { Id = "source", Type = FeaturedSourceTypes.Random }],
            new FeaturedUserProfile { UserId = _user.Id.ToString("N") },
            [], 0, new FeaturedDisplayPreferences(true, true, true, true, true), false);
        Dictionary<Guid, FeaturedItemSelectionReason> reasons = new()
        {
            [source[0].Id] = new("source", FeaturedSourceTypes.Random, false),
            [source[1].Id] = new("source", FeaturedSourceTypes.Random, true)
        };
        _cache.StoreRequestPool(_user, config, personalization,
            new FeaturedSelection(source, [], false,
                new FeaturedRuleEngineTiming(0, 0, 0, 0, 0, 0, 0, 0, 0), reasons));

        Assert.True(TryGet(config, personalization, [], 2, out List<FeaturedItemDto> items, out _));
        Assert.Null(items.Single(item => item.Id == source[0].Id.ToString()).Trailer);
        Assert.NotNull(items.Single(item => item.Id == source[1].Id.ToString()).Trailer);
    }

    [Fact]
    public void PreparedItemsExposeCurrentUserFavoriteState()
    {
        List<BaseItem> source = CreateItems(2);
        _userData.FavoriteIds.Add(source[0].Id);
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = CreatePersonalization();
        Store(config, personalization, source);

        Assert.True(TryGet(config, personalization, [], 2, out List<FeaturedItemDto> items, out _));
        Assert.True(items.Single(item => item.Id == source[0].Id.ToString()).IsFavorite);
        Assert.False(items.Single(item => item.Id == source[1].Id.ToString()).IsFavorite);
    }

    [Fact]
    public void PreparedItemsExposeCurrentUserPlayedState()
    {
        List<BaseItem> source = CreateItems(2);
        _userData.PlayedIds.Add(source[0].Id);
        PluginConfiguration config = new();
        FeaturedPersonalizationContext personalization = CreatePersonalization();
        Store(config, personalization, source);

        Assert.True(TryGet(config, personalization, [], 2, out List<FeaturedItemDto> items, out _));
        Assert.True(items.Single(item => item.Id == source[0].Id.ToString()).IsPlayed);
        Assert.False(items.Single(item => item.Id == source[1].Id.ToString()).IsPlayed);
    }
}
