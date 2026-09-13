using System.Reflection;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Globalization;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedUserAccessTests : IDisposable
{
    private readonly ILibraryManager _previousLibraryManager;
    private readonly ILocalizationManager _previousLocalizationManager;
    private readonly LibraryManagerStub _libraryManager;
    private readonly LocalizationManagerStub _localizationManager;

    public FeaturedUserAccessTests()
    {
        _previousLibraryManager = BaseItem.LibraryManager;
        _previousLocalizationManager = BaseItem.LocalizationManager;

        ILibraryManager libraryManager = DispatchProxy.Create<ILibraryManager, LibraryManagerStub>();
        _libraryManager = (LibraryManagerStub)libraryManager;
        BaseItem.LibraryManager = libraryManager;

        ILocalizationManager localizationManager = DispatchProxy.Create<ILocalizationManager, LocalizationManagerStub>();
        _localizationManager = (LocalizationManagerStub)localizationManager;
        BaseItem.LocalizationManager = localizationManager;
    }

    [Fact]
    public void UserWithAllLibraryAccessCanSeeCandidate()
    {
        User user = CreateUser(enableAllFolders: true);
        TestItem candidate = CreateCandidate(Guid.NewGuid());

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds([candidate], user);

        Assert.Contains(candidate.Id, allowedIds);
    }

    [Fact]
    public void UserWithSelectedLibraryAccessOnlySeesSelectedLibrary()
    {
        Guid selectedLibraryId = Guid.NewGuid();
        Guid otherLibraryId = Guid.NewGuid();
        User user = CreateUser(enableAllFolders: false);
        user.SetPreference(PreferenceKind.EnabledFolders, [selectedLibraryId]);
        TestItem selectedCandidate = CreateCandidate(selectedLibraryId);
        TestItem otherCandidate = CreateCandidate(otherLibraryId);

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds(
            [selectedCandidate, otherCandidate],
            user);

        Assert.Contains(selectedCandidate.Id, allowedIds);
        Assert.DoesNotContain(otherCandidate.Id, allowedIds);
    }

    [Fact]
    public void UserWithoutCandidateLibraryAccessCannotSeeCandidate()
    {
        User user = CreateUser(enableAllFolders: false);
        user.SetPreference(PreferenceKind.EnabledFolders, [Guid.NewGuid()]);
        TestItem candidate = CreateCandidate(Guid.NewGuid());

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds([candidate], user);

        Assert.DoesNotContain(candidate.Id, allowedIds);
    }

    [Fact]
    public void BlockedLibraryOverridesAllLibraryAccess()
    {
        Guid blockedLibraryId = Guid.NewGuid();
        User user = CreateUser(enableAllFolders: true);
        user.SetPreference(PreferenceKind.BlockedMediaFolders, [blockedLibraryId]);
        TestItem candidate = CreateCandidate(blockedLibraryId);

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds([candidate], user);

        Assert.DoesNotContain(candidate.Id, allowedIds);
    }

    [Fact]
    public void UserParentalRatingRestrictionHidesCandidate()
    {
        User user = CreateUser(enableAllFolders: true);
        user.MaxParentalRatingScore = 10;
        TestItem candidate = CreateCandidate(Guid.NewGuid());
        candidate.OfficialRating = "Restricted";
        _localizationManager.Ratings["Restricted"] = new ParentalRatingScore(18, 0);

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds([candidate], user);

        Assert.DoesNotContain(candidate.Id, allowedIds);
    }

    [Fact]
    public void BlockedTagRestrictionHidesCandidate()
    {
        User user = CreateUser(enableAllFolders: true);
        user.SetPreference(PreferenceKind.BlockedTags, ["restricted-tag"]);
        TestItem candidate = CreateCandidate(Guid.NewGuid());
        candidate.Tags = ["restricted-tag"];

        HashSet<Guid> allowedIds = FeaturedUserAccess.GetAllowedItemIds([candidate], user);

        Assert.DoesNotContain(candidate.Id, allowedIds);
    }

    public void Dispose()
    {
        BaseItem.LibraryManager = _previousLibraryManager;
        BaseItem.LocalizationManager = _previousLocalizationManager;
    }

    private TestItem CreateCandidate(Guid libraryId)
    {
        TestItem candidate = new()
        {
            Id = Guid.NewGuid(),
            Name = "Candidate",
            Path = $"/media/{Guid.NewGuid():N}.mkv",
            PreferredMetadataCountryCode = "US"
        };
        Folder library = new() { Id = libraryId };
        _libraryManager.CollectionFolders[candidate.Id] = [library];
        if (_libraryManager.UserRootChildren.All(item => item.Id != libraryId))
        {
            _libraryManager.UserRootChildren.Add(library);
        }

        return candidate;
    }

    private static User CreateUser(bool enableAllFolders)
    {
        User user = new("featured-test", "test-auth", "test-reset");
        user.SetPermission(PermissionKind.EnableAllFolders, enableAllFolders);
        return user;
    }

    public class LibraryManagerStub : DispatchProxy
    {
        public Dictionary<Guid, List<Folder>> CollectionFolders { get; } = [];

        public List<BaseItem> UserRootChildren { get; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ILibraryManager.GetCollectionFolders)
                && args is [{ } item])
            {
                return CollectionFolders.TryGetValue(((BaseItem)item).Id, out List<Folder>? folders)
                    ? folders
                    : new List<Folder>();
            }

            if (targetMethod?.Name == nameof(ILibraryManager.GetUserRootFolder))
            {
                return new Folder { Children = UserRootChildren };
            }

            return GetDefaultValue(targetMethod?.ReturnType);
        }
    }

    public class LocalizationManagerStub : DispatchProxy
    {
        public Dictionary<string, ParentalRatingScore> Ratings { get; } = new(StringComparer.OrdinalIgnoreCase);

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ILocalizationManager.GetRatingScore)
                && args is [{ } rating, ..])
            {
                return Ratings.GetValueOrDefault((string)rating);
            }

            return GetDefaultValue(targetMethod?.ReturnType);
        }
    }

    private static object? GetDefaultValue(Type? type)
        => type is not null && type.IsValueType ? Activator.CreateInstance(type) : null;

    private sealed class TestItem : BaseItem
    {
    }
}
