using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class YouTubeTrailerFilterConfigurationTests : FeaturedPreparedCacheTestBase
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("server-only-secret", true)]
    public void AdministratorCanCheckKeyPresenceWithoutReceivingTheKey(string? apiKey, bool expected)
    {
        _user.SetPermission(PermissionKind.IsAdministrator, true);
        using YouTubeTrailerQualityService service = new(null!, () => apiKey);
        OkObjectResult result = Assert.IsType<OkObjectResult>(CreateStatusController().GetYouTubeApiKeyStatus(service).Result);
        YouTubeApiKeyStatusDto status = Assert.IsType<YouTubeApiKeyStatusDto>(result.Value);
        Assert.Equal(expected, status.ApiKeyConfigured);
        string json = JsonSerializer.Serialize(status, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(expected ? "{\"apiKeyConfigured\":true}" : "{\"apiKeyConfigured\":false}", json);
    }

    [Fact]
    public void NonAdministratorsCannotInspectKeyPresence()
    {
        _user.SetPermission(PermissionKind.IsAdministrator, false);
        using YouTubeTrailerQualityService service = new(null!, () => throw new InvalidOperationException("Must not inspect key"));
        Assert.IsType<ForbidResult>(CreateStatusController().GetYouTubeApiKeyStatus(service).Result);
    }

    private FeaturedController CreateStatusController()
    {
        IUserManager manager = DispatchProxy.Create<IUserManager, StatusUserManagerStub>();
        ((StatusUserManagerStub)manager).Users = [_user];
        FeaturedController controller = new(
            manager, _libraryManagerService, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!,
            NullLogger<FeaturedController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, _user.Username)], "test"))
            }
        };
        return controller;
    }

    public class StatusUserManagerStub : UserManagerStub
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == nameof(IUserManager.GetUserByName)
                ? Users.FirstOrDefault(user => user.Username == (string)args![0]!)
                : base.Invoke(targetMethod, args);
    }

    [Theory]
    [InlineData(null, null, false)]
    [InlineData("inherit", "disabled", false)]
    [InlineData("inherit", "hd_only", true)]
    [InlineData("enabled", "disabled", true)]
    [InlineData("enabled", "hd_only", true)]
    [InlineData("disabled", "hd_only", false)]
    [InlineData("disabled", "disabled", false)]
    [InlineData("invalid", "hd_only", true)]
    [InlineData("inherit", "invalid", false)]
    public void SourceOverrideTakesPriority(string? source, string? global, bool expected)
        => Assert.Equal(expected, TrailerResolver.IsYouTubeQualityFilterEnabled(source, global));

    [Fact]
    public void DefaultsPreserveOldPlaybackAndInvalidSettingsNormalizeSafely()
    {
        Assert.Equal("disabled", new PluginConfiguration().YouTubeQualityFilter);
        Assert.Equal("inherit", new FeaturedSourceRule().YouTubeQualityFilter);
        PluginConfiguration config = new()
        {
            YouTubeQualityFilter = "invalid",
            SourceRules = [new FeaturedSourceRule { YouTubeQualityFilter = "invalid" }],
            Presets = [new FeaturedPreset { Trailers = new() { YouTubeQualityFilter = "invalid" } }]
        };
        PluginConfigurationNormalizer.Normalize(config);
        Assert.Equal("disabled", config.YouTubeQualityFilter);
        Assert.Equal("inherit", config.SourceRules.Single().YouTubeQualityFilter);
        Assert.Equal("disabled", config.Presets.Single().Trailers.YouTubeQualityFilter);
    }

    [Theory]
    [InlineData("hd_only", "inherit", true)]
    [InlineData("disabled", "enabled", true)]
    [InlineData("hd_only", "disabled", false)]
    public void ResolverMarksOnlyYouTubeCandidatesIncludingManualOverrides(string global, string source, bool expected)
    {
        BaseItem movie = new TestMovie { Id = Guid.NewGuid(), Name = "Movie" };
        movie.RemoteTrailers =
        [
            new MediaBrowser.Model.Entities.MediaUrl { Url = "https://www.youtube.com/watch?v=remote12345" },
            new MediaBrowser.Model.Entities.MediaUrl { Url = "https://example.test/trailer.mp4" }
        ];
        PluginConfiguration config = new()
        {
            YouTubeQualityFilter = global,
            TrailerOverrides = [new FeaturedTrailerOverride { ItemId = movie.Id.ToString(), Url = "https://youtu.be/manual12345" }]
        };
        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService).ResolveCandidates(
            movie, _user, config, [FeaturedMediaPriorityTypes.RemoteTrailer, FeaturedMediaPriorityTypes.Trickplay], true, source);
        Assert.Equal(["youtube", "youtube", "direct", "trickplay"], candidates.Select(candidate => candidate.Provider));
        Assert.All(candidates.Where(candidate => candidate.Provider == "youtube"), candidate => Assert.Equal(expected, candidate.YouTubeQualityFilterEnabled));
        Assert.All(candidates.Where(candidate => candidate.Provider != "youtube"), candidate => Assert.False(candidate.YouTubeQualityFilterEnabled));
    }

    [Fact]
    public void PersonalizedSourcesAndPresetMappingKeepTheOverride()
    {
        FeaturedPreset preset = new()
        {
            Trailers = new() { YouTubeQualityFilter = "hd_only" },
            SourceRules = [new FeaturedSourceRule { YouTubeQualityFilter = "disabled" }]
        };
        PluginConfiguration config = new();
        FeaturedConfigurationMappings.ApplyPreset(config, preset);
        Assert.Equal("hd_only", config.YouTubeQualityFilter);
        FeaturedPersonalizationContext personalized = _personalization.Resolve(config, _user.Id);
        Assert.Equal("disabled", personalized.SourceRules.Single().YouTubeQualityFilter);
    }
}
