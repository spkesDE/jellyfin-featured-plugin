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
    public void SourceUserRestrictionsAreAppliedBeforePersonalization()
    {
        string visibleSourceId = Guid.NewGuid().ToString("N");
        PluginConfiguration config = new()
        {
            SourceRules =
            [
                new FeaturedSourceRule
                {
                    Id = visibleSourceId,
                    Type = FeaturedSourceTypes.Random,
                    UserIds = [_user.Id.ToString("N")],
                    MediaPriority =
                    [
                        new FeaturedMediaPriorityEntry { Type = FeaturedMediaPriorityTypes.Trickplay, Enabled = true },
                        new FeaturedMediaPriorityEntry { Type = FeaturedMediaPriorityTypes.LocalTrailer, Enabled = false }
                    ]
                },
                new FeaturedSourceRule
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Type = FeaturedSourceTypes.LatestReleases,
                    UserIds = [Guid.NewGuid().ToString("N")]
                }
            ]
        };

        FeaturedPersonalizationContext effective = _personalization.Resolve(config, _user.Id);

        FeaturedSourceRule source = Assert.Single(effective.SourceRules);
        Assert.Equal(visibleSourceId, source.Id);
        Assert.Equal(
            [FeaturedMediaPriorityTypes.Trickplay, FeaturedMediaPriorityTypes.LocalTrailer],
            source.MediaPriority.Select(entry => entry.Type));
        Assert.True(source.MediaPriority[0].Enabled);
        Assert.Equal(_user.Id.ToString("N"), Assert.Single(source.UserIds));
    }

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

    [Fact]
    public void RememberedTrailerAudioOverridesAdminDefaultWhenAllowed()
    {
        PluginConfiguration config = new() { StartTrailersMuted = true };
        Assert.True(config.PersonalizationPolicy.AllowRememberTrailerAudio);
        Assert.True(FeaturedPersonalizationService.CanRememberTrailerAudio(config));
        string fingerprint = _personalization.Resolve(config, _user.Id).Fingerprint;

        Assert.Null(new FeaturedItemsResponseDto(
            config, [], 5, 5, _personalization.Resolve(config, _user.Id), null, null, null).TrailerVolume);

        _personalization.SetTrailerAudio(_user.Id, false, null);
        _personalization.SetTrailerAudio(_user.Id, null, 140);
        FeaturedPersonalizationContext effective = _personalization.Resolve(config, _user.Id);

        // Partial updates keep the other value, and the volume is clamped to 0-100.
        Assert.False(effective.Display.StartTrailersMuted);
        Assert.Equal(100, effective.Display.TrailerVolume);
        _personalization.SetTrailerAudio(_user.Id, null, 35);
        effective = _personalization.Resolve(config, _user.Id);
        FeaturedItemsResponseDto response = new(config, [], 5, 5, effective, null, null, null);
        Assert.False(response.StartTrailersMuted);
        Assert.Equal(35, response.TrailerVolume);
        Assert.True(response.RememberTrailerAudio);
        Assert.True(_personalization.ResolveDefaults(config, _user.Id).Display.StartTrailersMuted);
        Assert.Null(_personalization.ResolveDefaults(config, _user.Id).Display.TrailerVolume);
        // Changing trailer audio must not invalidate the prepared feed.
        Assert.Equal(fingerprint, effective.Fingerprint);

        // A dialog save keeps the explicit value, and a reset returns to the admin default.
        config.StartTrailersMuted = false;
        _personalization.NormalizeAndSave(
            config,
            _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences { StartTrailersMuted = true, TrailerVolume = -5 }
            },
            new HashSet<string>());
        Assert.True(_personalization.Resolve(config, _user.Id).Display.StartTrailersMuted);
        Assert.Equal(0, _personalization.Resolve(config, _user.Id).Display.TrailerVolume);
        _personalization.Remove(_user.Id);
        Assert.False(_personalization.Resolve(config, _user.Id).Display.StartTrailersMuted);
        Assert.Null(_personalization.Resolve(config, _user.Id).Display.TrailerVolume);
    }

    [Fact]
    public void UserCanKeepTrailerAudioForTheSessionOnly()
    {
        PluginConfiguration config = new() { StartTrailersMuted = true };
        FeaturedPersonalizationContext defaults = _personalization.Resolve(config, _user.Id);
        Assert.True(defaults.Display.AutoSaveTrailerAudio);
        Assert.True(new FeaturedItemsResponseDto(config, [], 5, 5, defaults, null, null, null).AutoSaveTrailerAudio);

        // Only "off" is stored; the saved mute and volume stay as the user's defaults.
        _personalization.NormalizeAndSave(
            config,
            _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences
                {
                    AutoSaveTrailerAudio = false,
                    StartTrailersMuted = false,
                    TrailerVolume = 30
                }
            },
            new HashSet<string>());
        FeaturedPersonalizationContext effective = _personalization.Resolve(config, _user.Id);
        FeaturedItemsResponseDto response = new(config, [], 5, 5, effective, null, null, null);

        Assert.False(_personalization.Get(_user.Id)?.Display.AutoSaveTrailerAudio);
        Assert.False(response.AutoSaveTrailerAudio);
        Assert.False(response.StartTrailersMuted);
        Assert.Equal(30, response.TrailerVolume);
        Assert.Equal(defaults.Fingerprint, effective.Fingerprint);

        _personalization.NormalizeAndSave(
            config,
            _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences { AutoSaveTrailerAudio = true }
            },
            new HashSet<string>());
        Assert.Null(_personalization.Get(_user.Id));
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void AdminCanStopRememberingTrailerAudio(bool personalizationEnabled, bool allowRemember)
    {
        PluginConfiguration config = new()
        {
            StartTrailersMuted = true,
            PersonalizationPolicy = new FeaturedPersonalizationPolicy
            {
                Enabled = personalizationEnabled,
                AllowRememberTrailerAudio = allowRemember
            }
        };
        _personalization.SetTrailerAudio(_user.Id, false, 20);

        FeaturedPersonalizationContext effective = _personalization.Resolve(config, _user.Id);
        FeaturedItemsResponseDto response = new(config, [], 5, 5, effective, null, null, null);

        Assert.False(FeaturedPersonalizationService.CanRememberTrailerAudio(config));
        Assert.True(effective.Display.StartTrailersMuted);
        Assert.Null(effective.Display.TrailerVolume);
        Assert.False(response.RememberTrailerAudio);
        Assert.False(response.AutoSaveTrailerAudio);
        Assert.Null(response.TrailerVolume);
    }

    [Fact]
    public void DismissalButtonCanBeHiddenByUserOrAdminWithoutPersonalization()
    {
        PluginConfiguration config = new()
        {
            PersonalizationPolicy = new FeaturedPersonalizationPolicy { Enabled = false },
            DismissalPolicy = new FeaturedDismissalPolicy { Enabled = true },
            ShowDismissalButton = true
        };

        Assert.True(_personalization.Resolve(config, _user.Id).Display.ShowDismissalButton);
        _personalization.NormalizeAndSave(
            config,
            _user.Id,
            new FeaturedUserPreferences
            {
                Display = new FeaturedUserDisplayPreferences { ShowDismissalButton = false }
            },
            new HashSet<string>());

        Assert.False(_personalization.Resolve(config, _user.Id).Display.ShowDismissalButton);

        _personalization.Remove(_user.Id);
        config.ShowDismissalButton = false;
        Assert.False(_personalization.Resolve(config, _user.Id).Display.ShowDismissalButton);
    }
}
