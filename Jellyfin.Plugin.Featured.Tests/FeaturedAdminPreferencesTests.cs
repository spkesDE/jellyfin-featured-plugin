using System.Reflection;
using System.Security.Claims;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedAdminPreferencesTests : FeaturedPreparedCacheTestBase
{
    [Theory]
    [InlineData("get")]
    [InlineData("put")]
    [InlineData("options")]
    [InlineData("bootstrap")]
    [InlineData("dismissals")]
    [InlineData("undo")]
    [InlineData("reset-dismissals")]
    public void RegularUserCannotAccessAnotherUsersSettings(string operation)
    {
        using MemoryCache memory = new(new MemoryCacheOptions());
        FeaturedController controller = CreateController(memory, out TargetUserManagerStub users);
        _user.SetPermission(PermissionKind.IsAdministrator, false);

        ActionResult? result = Invoke(controller, operation, Guid.NewGuid());

        Assert.IsType<ForbidResult>(result);
        Assert.Equal(0, users.TargetLookups);
    }

    [Theory]
    [InlineData("get")]
    [InlineData("put")]
    [InlineData("options")]
    [InlineData("bootstrap")]
    [InlineData("dismissals")]
    [InlineData("undo")]
    [InlineData("reset-dismissals")]
    public void AdministratorGetsNotFoundForMissingUser(string operation)
    {
        using MemoryCache memory = new(new MemoryCacheOptions());
        FeaturedController controller = CreateController(memory, out _);
        _user.SetPermission(PermissionKind.IsAdministrator, true);

        Assert.IsType<NotFoundResult>(Invoke(controller, operation, Guid.NewGuid()));
    }

    [Fact]
    public void AdministratorEditsTheActualUserPreferencesAndResetOnlyAffectsThatUser()
    {
        using MemoryCache memory = new(new MemoryCacheOptions());
        FeaturedController controller = CreateController(memory, out TargetUserManagerStub users);
        _user.SetPermission(PermissionKind.IsAdministrator, true);
        User target = new("target-user", "test-auth", "test-reset");
        users.Users = [_user, target];
        FeaturedPreferenceOptionsCache options = new(memory, NullLogger<FeaturedPreferenceOptionsCache>.Instance);
        options.GetOrCreate(target.Id, () => ["Drama"]);
        PluginConfiguration config = new();
        _personalization.NormalizeAndSave(config, _user.Id, new FeaturedUserPreferences { UnplayedBoost = 19 }, new HashSet<string>());

        JsonResult saved = Assert.IsType<JsonResult>(controller.PutPreferences(new FeaturedPreferencesUpdate
        {
            Preferences = new FeaturedUserPreferences { UnplayedBoost = 77, PreferredGenres = ["Drama", "Invisible"] }
        }, target.Id).Result);
        Assert.Equal(77, Assert.IsType<FeaturedPreferencesResponse>(saved.Value).Effective.UnplayedBoost);
        Assert.Equal(77, _personalization.Get(target.Id)!.UnplayedBoost);
        Assert.Equal(["Drama"], _personalization.Get(target.Id)!.PreferredGenres!);
        Assert.Equal(19, _personalization.Get(_user.Id)!.UnplayedBoost);

        FeaturedPreferencesBootstrapResponse bootstrap = Assert.IsType<FeaturedPreferencesBootstrapResponse>(
            Assert.IsType<JsonResult>(controller.GetPreferencesBootstrap(target.Id).Result).Value);
        Assert.Equal(77, bootstrap.Current.Effective.UnplayedBoost);
        Assert.Equal(["Drama"], bootstrap.Options.Genres);
        Assert.True(bootstrap.Current.HasOverrides);

        Assert.IsType<JsonResult>(controller.PutPreferences(new FeaturedPreferencesUpdate { Reset = true }, target.Id).Result);
        Assert.Null(_personalization.Get(target.Id));
        Assert.Equal(19, _personalization.Get(_user.Id)!.UnplayedBoost);
    }

    [Fact]
    public void GlobalDefaultsReplaceLegacyPerUserServerDefaults()
    {
        PluginConfiguration config = new()
        {
            PersonalizationDefaults = new FeaturedPersonalizationDefaults { UnplayedBoost = 12, PreferredGenres = ["Drama"] },
            UserProfiles = [new FeaturedUserProfile { UserId = _user.Id.ToString(), Enabled = true, UnplayedBoost = 99, PreferredGenres = ["Comedy"] }]
        };

        FeaturedPersonalizationContext defaults = _personalization.ResolveDefaults(config, _user.Id);
        Assert.Equal(12, defaults.Profile.UnplayedBoost);
        Assert.Equal(["Drama"], defaults.Profile.PreferredGenres);
        _personalization.NormalizeAndSave(config, _user.Id, new FeaturedUserPreferences { UnplayedBoost = 45 }, new HashSet<string>());
        Assert.Equal(45, _personalization.Resolve(config, _user.Id).Profile.UnplayedBoost);
    }

    private FeaturedController CreateController(IMemoryCache memory, out TargetUserManagerStub users)
    {
        IUserManager manager = DispatchProxy.Create<IUserManager, TargetUserManagerStub>();
        users = (TargetUserManagerStub)manager;
        users.Users = [_user];
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;
        FeaturedController controller = new(
            manager, _libraryManagerService, _historyStore,
            new FeaturedDismissalStore(paths, NullLogger<FeaturedDismissalStore>.Instance),
            _candidateCache, null!, _cache, _personalization,
            new FeaturedPreferenceOptionsCache(memory, NullLogger<FeaturedPreferenceOptionsCache>.Instance),
            null!, null!, null!, NullLogger<FeaturedController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, _user.Username)], "test"))
            }
        };
        return controller;
    }

    private static ActionResult? Invoke(FeaturedController controller, string operation, Guid userId)
        => operation switch
        {
            "get" => controller.GetPreferences(userId).Result,
            "put" => controller.PutPreferences(new FeaturedPreferencesUpdate { Reset = true }, userId).Result,
            "options" => controller.GetPreferenceOptions(userId).Result,
            "bootstrap" => controller.GetPreferencesBootstrap(userId).Result,
            "dismissals" => controller.GetDismissals(userId).Result,
            "undo" => controller.UndoDismissal(new FeaturedDismissalUndoRequest { DismissalId = "test" }, userId).Result,
            "reset-dismissals" => controller.ResetDismissals(userId).Result,
            _ => throw new ArgumentException(operation)
        };

    public class TargetUserManagerStub : DispatchProxy
    {
        public User[] Users { get; set; } = [];
        public int TargetLookups { get; private set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(IUserManager.GetUserByName))
                return Users.FirstOrDefault(user => user.Username == (string)args![0]!);
            if (targetMethod?.Name == nameof(IUserManager.GetUserById))
            {
                TargetLookups++;
                return Users.FirstOrDefault(user => user.Id == (Guid)args![0]!);
            }
            return GetDefaultValue(targetMethod?.ReturnType);
        }
    }
}
