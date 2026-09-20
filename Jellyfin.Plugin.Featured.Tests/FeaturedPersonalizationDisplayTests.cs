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

public sealed class FeaturedPersonalizationDisplayTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void UserDisplayPreferencesOnlyDisableAdminEnabledFeatures()
    {
        PluginConfiguration config = new()
        {
            EnableBackgroundTrailers = true,
            ShowRating = true,
            ShowDescription = true,
            ShowYear = true,
            ShowRuntime = true,
            ShowFavoriteButton = true
        };
        Assert.True(_personalization.Resolve(config, _user.Id).Display.ShowFavoriteButton);
        _personalization.NormalizeAndSave(
            config,
            _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences
                {
                    EnableBackgroundTrailers = false,
                    ShowRating = false,
                    ShowDescription = true,
                    ShowYear = false,
                    ShowRuntime = true,
                    ShowFavoriteButton = false
                }
            },
            new HashSet<string>());

        FeaturedPersonalizationContext effective = _personalization.Resolve(config, _user.Id);

        Assert.False(effective.Display.EnableBackgroundTrailers);
        Assert.False(effective.Display.ShowRating);
        Assert.True(effective.Display.ShowDescription);
        Assert.False(effective.Display.ShowYear);
        Assert.True(effective.Display.ShowRuntime);
        Assert.False(effective.Display.ShowFavoriteButton);

        FeaturedItemsResponseDto response = new(config, [], 5, 5, effective, null, null, null);
        Assert.False(response.EnableBackgroundTrailers);
        Assert.False(response.ShowRating);
        Assert.True(response.ShowDescription);
        Assert.False(response.ShowYear);
        Assert.True(response.ShowRuntime);
        Assert.False(response.ShowFavoriteButton);

        config.ShowDescription = false;
        config.ShowRuntime = false;
        config.ShowFavoriteButton = false;
        effective = _personalization.Resolve(config, _user.Id);

        Assert.False(effective.Display.ShowDescription);
        Assert.False(effective.Display.ShowRuntime);
        Assert.False(effective.Display.ShowFavoriteButton);

        _personalization.NormalizeAndSave(config, _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences { ShowFavoriteButton = true }
            }, new HashSet<string>());
        Assert.False(_personalization.Resolve(config, _user.Id).Display.ShowFavoriteButton);
    }
}
