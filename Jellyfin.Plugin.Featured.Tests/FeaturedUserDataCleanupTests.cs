using System.Reflection;
using Jellyfin.Data.Events.Users;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedUserDataCleanupTests : FeaturedPreparedCacheTestBase
{
    private readonly FeaturedPreferenceStore _preferenceStore;
    private readonly FeaturedDismissalStore _dismissalStore;
    private readonly FeaturedUserDataCleanup _cleanup;

    public FeaturedUserDataCleanupTests()
    {
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;
        _preferenceStore = new FeaturedPreferenceStore(paths, NullLogger<FeaturedPreferenceStore>.Instance);
        _dismissalStore = new FeaturedDismissalStore(paths, NullLogger<FeaturedDismissalStore>.Instance);
        _cleanup = new FeaturedUserDataCleanup(
            _historyStore,
            _preferenceStore,
            _dismissalStore,
            _cache,
            _candidateCache,
            _userManager,
            NullLogger<FeaturedUserDataCleanup>.Instance);
    }

    [Fact]
    public void DeletedUserEventRemovesOnlyThatUsersData()
    {
        User deleted = new("deleted-user", "test-auth", "test-reset");
        StoreDataFor(deleted.Id);
        StoreDataFor(_user.Id);

        new FeaturedUserDeletedConsumer(_cleanup).OnEvent(new UserDeletedEventArgs(deleted));

        AssertHasNoData(deleted.Id);
        AssertHasData(_user.Id);
    }

    [Fact]
    public void RemovesDataOfUsersThatNoLongerExist()
    {
        Guid deletedUserId = Guid.NewGuid();
        StoreDataFor(deletedUserId);
        StoreDataFor(_user.Id);

        Assert.Equal(1, _cleanup.RemoveDeletedUsers());

        AssertHasNoData(deletedUserId);
        AssertHasData(_user.Id);
    }

    [Fact]
    public void KeepsAllDataWhileJellyfinReportsNoUsers()
    {
        ((UserManagerStub)_userManager).Users = [];
        StoreDataFor(_user.Id);

        Assert.Equal(0, _cleanup.RemoveDeletedUsers());

        AssertHasData(_user.Id);
    }

    private void StoreDataFor(Guid userId)
    {
        _historyStore.Record(userId, Guid.NewGuid());
        _preferenceStore.Set(userId, new FeaturedUserPreferences());
        _dismissalStore.Add(userId, new FeaturedDismissalEntry
        {
            Scope = FeaturedDismissalScopes.Title,
            Key = Guid.NewGuid().ToString("N"),
            Name = "Movie",
            ItemId = Guid.NewGuid().ToString("N"),
            DismissedAt = DateTimeOffset.UtcNow
        });
    }

    private void AssertHasData(Guid userId)
    {
        Assert.Equal(1, _historyStore.GetEntryCount(userId));
        Assert.NotNull(_preferenceStore.Get(userId));
        Assert.Single(_dismissalStore.Get(userId));
    }

    private void AssertHasNoData(Guid userId)
    {
        Assert.Equal(0, _historyStore.GetEntryCount(userId));
        Assert.Null(_preferenceStore.Get(userId));
        Assert.Empty(_dismissalStore.Get(userId));
    }
}
