using System.Reflection;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.TV;
using MediaBrowser.Model.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public abstract class FeaturedPreparedCacheTestBase : IDisposable
{
    protected readonly string _temporaryPath = Path.Combine(Path.GetTempPath(), "Jellyfin.Featured.Tests", Guid.NewGuid().ToString("N"));
    protected readonly ILibraryManager _previousLibraryManager;
    protected readonly IUserManager _userManager;
    protected readonly ILibraryManager _libraryManagerService;
    protected readonly IUserDataManager _userDataManager;
    protected readonly UserDataManagerStub _userData;
    protected readonly LibraryManagerStub _libraryManager;
    protected readonly FeaturedDisplayHistoryStore _historyStore;
    protected readonly FeaturedPersonalizationService _personalization;
    protected readonly FeaturedPreparedCache _cache;
    protected readonly User _user;

    protected FeaturedPreparedCacheTestBase()
    {
        Directory.CreateDirectory(_temporaryPath);
        _previousLibraryManager = BaseItem.LibraryManager;

        _user = new User("prepared-cache-test", "test-auth", "test-reset");
        _user.SetPermission(PermissionKind.EnableAllFolders, true);

        IUserManager userManager = DispatchProxy.Create<IUserManager, UserManagerStub>();
        ((UserManagerStub)userManager).Users = [_user];
        _userManager = userManager;

        ILibraryManager libraryManager = DispatchProxy.Create<ILibraryManager, LibraryManagerStub>();
        _libraryManagerService = libraryManager;
        _libraryManager = (LibraryManagerStub)libraryManager;
        BaseItem.LibraryManager = libraryManager;

        IUserDataManager userDataManager = DispatchProxy.Create<IUserDataManager, UserDataManagerStub>();
        _userDataManager = userDataManager;
        _userData = (UserDataManagerStub)userDataManager;
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;

        _historyStore = new FeaturedDisplayHistoryStore(paths, NullLogger<FeaturedDisplayHistoryStore>.Instance);
        FeaturedPreferenceStore preferenceStore = new(paths, NullLogger<FeaturedPreferenceStore>.Instance);
        _personalization = new FeaturedPersonalizationService(preferenceStore);
        FeaturedItemDtoFactory dtoFactory = new(new TrailerResolver(libraryManager));
        FeaturedMediaMetadataService mediaMetadata = new(
            libraryManager,
            DispatchProxy.Create<IMediaSourceManager, EmptyServiceStub>(),
            DispatchProxy.Create<ITVSeriesManager, EmptyServiceStub>());
        _cache = new FeaturedPreparedCache(
            userManager,
            libraryManager,
            userDataManager,
            _historyStore,
            new FeaturedDismissalStore(paths, NullLogger<FeaturedDismissalStore>.Instance),
            new FeaturedCandidateCache(),
            new FeaturedRecommendationCandidates(
                DispatchProxy.Create<ISimilarItemsManager, SimilarItemsManagerStub>(),
                NullLogger<FeaturedRecommendationCandidates>.Instance),
            mediaMetadata,
            _personalization,
            dtoFactory,
            NullLogger<FeaturedPreparedCache>.Instance);
    }

    public void Dispose()
    {
        BaseItem.LibraryManager = _previousLibraryManager;
        _historyStore.Dispose();
        if (Directory.Exists(_temporaryPath)) Directory.Delete(_temporaryPath, recursive: true);
    }

    protected void Store(
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        IReadOnlyList<BaseItem> items)
        => _cache.StoreRequestPool(_user, config, personalization,
            new FeaturedSelection(items.ToList(), [], false,
                new FeaturedRuleEngineTiming(0, 0, 0, 0, 0, 0, 0, 0),
                new Dictionary<Guid, FeaturedItemSelectionReason>()));

    protected bool TryGet(
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        HashSet<Guid> excludedIds,
        int requestedCount,
        out List<FeaturedItemDto> items,
        out string status)
        => _cache.TryGetItems(
            _user,
            config,
            personalization,
            excludedIds,
            requestedCount,
            out items,
            out status,
            out _);

    protected FeaturedPersonalizationContext CreatePersonalization(int unplayedBoost = 25)
        => new(
            [new FeaturedSourceRule { Id = "default-random", Type = FeaturedSourceTypes.Random }],
            new FeaturedUserProfile
            {
                UserId = _user.Id.ToString("N"),
                UnplayedBoost = unplayedBoost
            },
            [],
            0,
            new FeaturedDisplayPreferences(false, true, true, true, true),
            false);

    protected List<BaseItem> CreateItems(int count)
    {
        Folder library = new() { Id = Guid.NewGuid() };
        List<BaseItem> items = Enumerable.Range(0, count)
            .Select(index => (BaseItem)new TestMovie
            {
                Id = Guid.NewGuid(),
                Name = $"Candidate {index}",
                Path = $"/media/candidate-{index}.mkv",
                ImageInfos = [new ItemImageInfo { Path = $"/images/{index}.jpg", Type = ImageType.Primary }]
            })
            .ToList();
        foreach (BaseItem item in items) _libraryManager.CollectionFolders[item.Id] = [library];
        return items;
    }

    public class UserManagerStub : DispatchProxy
    {
        public User[] Users { get; set; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name switch
            {
                nameof(IUserManager.GetUsers) => Users,
                nameof(IUserManager.GetUserById) => Users.FirstOrDefault(user => args is [{ } id] && user.Id == (Guid)id),
                _ => GetDefaultValue(targetMethod?.ReturnType)
            };
    }

    public class SimilarItemsManagerStub : DispatchProxy
    {
        public IReadOnlyList<SimilarItemsRecommendation> Recommendations { get; set; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == nameof(ISimilarItemsManager.GetMovieRecommendationsAsync)
                ? Task.FromResult(Recommendations)
                : GetDefaultValue(targetMethod?.ReturnType);
    }

    public class LibraryManagerStub : DispatchProxy
    {
        public List<BaseItem> Candidates { get; } = [];

        public Dictionary<Guid, List<Folder>> CollectionFolders { get; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ILibraryManager.GetItemList)) return Candidates.ToList();
            if (targetMethod?.Name == nameof(ILibraryManager.GetCollectionFolders)
                && args is [{ } item, ..])
            {
                return CollectionFolders.GetValueOrDefault(((BaseItem)item).Id) ?? [];
            }

            return GetDefaultValue(targetMethod?.ReturnType);
        }
    }

    public class UserDataManagerStub : DispatchProxy
    {
        public HashSet<Guid> FavoriteIds { get; } = [];
        public HashSet<Guid> PlayedIds { get; } = [];

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == nameof(IUserDataManager.GetUserDataBatch)
                ? ((IReadOnlyList<BaseItem>)args![0]!)
                    .Where(item => FavoriteIds.Contains(item.Id) || PlayedIds.Contains(item.Id))
                    .ToDictionary(item => item.Id, item => new UserItemData
                    {
                        Key = item.Id.ToString(),
                        IsFavorite = FavoriteIds.Contains(item.Id),
                        Played = PlayedIds.Contains(item.Id)
                    })
                : GetDefaultValue(targetMethod?.ReturnType);
    }

    public class ApplicationPathsStub : DispatchProxy
    {
        public string PluginConfigurationsPath { get; set; } = string.Empty;

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == "get_PluginConfigurationsPath"
                ? PluginConfigurationsPath
                : GetDefaultValue(targetMethod?.ReturnType);
    }

    public class EmptyServiceStub : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => GetDefaultValue(targetMethod?.ReturnType);
    }

    protected sealed class TestMovie : Movie
    {
        public override SourceType SourceType => SourceType.Library;

        public override string GetClientTypeName() => nameof(Movie);
    }

    protected static object? GetDefaultValue(Type? type)
        => type is not null && type.IsValueType ? Activator.CreateInstance(type) : null;
}
