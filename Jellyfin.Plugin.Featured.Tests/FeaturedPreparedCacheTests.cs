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

public sealed class FeaturedPreparedCacheTests : IDisposable
{
    private readonly string _temporaryPath = Path.Combine(Path.GetTempPath(), "Jellyfin.Featured.Tests", Guid.NewGuid().ToString("N"));
    private readonly ILibraryManager _previousLibraryManager;
    private readonly IUserManager _userManager;
    private readonly UserDataManagerStub _userData;
    private readonly LibraryManagerStub _libraryManager;
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedPersonalizationService _personalization;
    private readonly FeaturedPreparedCache _cache;
    private readonly User _user;

    public FeaturedPreparedCacheTests()
    {
        Directory.CreateDirectory(_temporaryPath);
        _previousLibraryManager = BaseItem.LibraryManager;

        _user = new User("prepared-cache-test", "test-auth", "test-reset");
        _user.SetPermission(PermissionKind.EnableAllFolders, true);

        IUserManager userManager = DispatchProxy.Create<IUserManager, UserManagerStub>();
        ((UserManagerStub)userManager).Users = [_user];
        _userManager = userManager;

        ILibraryManager libraryManager = DispatchProxy.Create<ILibraryManager, LibraryManagerStub>();
        _libraryManager = (LibraryManagerStub)libraryManager;
        BaseItem.LibraryManager = libraryManager;

        IUserDataManager userDataManager = DispatchProxy.Create<IUserDataManager, UserDataManagerStub>();
        _userData = (UserDataManagerStub)userDataManager;
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).PluginConfigurationsPath = _temporaryPath;

        _historyStore = new FeaturedDisplayHistoryStore(paths, NullLogger<FeaturedDisplayHistoryStore>.Instance);
        FeaturedPreferenceStore preferenceStore = new(paths, NullLogger<FeaturedPreferenceStore>.Instance);
        _personalization = new FeaturedPersonalizationService(preferenceStore);
        FeaturedItemDtoFactory dtoFactory = new(new TrailerResolver(libraryManager));
        _cache = new FeaturedPreparedCache(
            userManager,
            libraryManager,
            userDataManager,
            _historyStore,
            new FeaturedCandidateCache(),
            new FeaturedRecommendationCandidates(
                DispatchProxy.Create<ISimilarItemsManager, SimilarItemsManagerStub>(),
                NullLogger<FeaturedRecommendationCandidates>.Instance),
            _personalization,
            dtoFactory,
            NullLogger<FeaturedPreparedCache>.Instance);
    }

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
                new FeaturedRuleEngineTiming(0, 0, 0, 0, 0, 0, 0, 0), reasons));

        Assert.True(TryGet(config, personalization, [], 2, out List<FeaturedItemDto> items, out _));
        Assert.Null(items.Single(item => item.Id == source[0].Id.ToString()).Trailer);
        Assert.NotNull(items.Single(item => item.Id == source[1].Id.ToString()).Trailer);
    }

    [Fact]
    public void MovieRecommendationCandidatesKeepProviderOrderAndRemoveDuplicates()
    {
        List<BaseItem> movies = CreateItems(2);
        ISimilarItemsManager manager = DispatchProxy.Create<ISimilarItemsManager, SimilarItemsManagerStub>();
        ((SimilarItemsManagerStub)manager).Recommendations =
        [
            new MediaBrowser.Controller.Library.SimilarItemsRecommendation
            {
                BaselineItemName = "Watched movie",
                CategoryId = Guid.NewGuid(),
                RecommendationType = MediaBrowser.Model.Dto.RecommendationType.SimilarToRecentlyPlayed,
                Items = [movies[0], movies[1], movies[0]]
            }
        ];
        FeaturedRecommendationCandidates candidates = new(manager, NullLogger<FeaturedRecommendationCandidates>.Instance);

        Assert.Equal(movies.Select(movie => movie.Id),
            candidates.GetMovieRecommendations(_user, 10).Select(movie => movie.Id));
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

    public void Dispose()
    {
        BaseItem.LibraryManager = _previousLibraryManager;
        _historyStore.Dispose();
        if (Directory.Exists(_temporaryPath)) Directory.Delete(_temporaryPath, recursive: true);
    }

    private void Store(
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        IReadOnlyList<BaseItem> items)
        => _cache.StoreRequestPool(_user, config, personalization,
            new FeaturedSelection(items.ToList(), [], false,
                new FeaturedRuleEngineTiming(0, 0, 0, 0, 0, 0, 0, 0),
                new Dictionary<Guid, FeaturedItemSelectionReason>()));

    private bool TryGet(
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

    private FeaturedPersonalizationContext CreatePersonalization(int unplayedBoost = 25)
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

    private List<BaseItem> CreateItems(int count)
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

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == nameof(IUserDataManager.GetUserDataBatch)
                ? ((IReadOnlyList<BaseItem>)args![0]!).Where(item => FavoriteIds.Contains(item.Id))
                    .ToDictionary(item => item.Id, item => new UserItemData { Key = item.Id.ToString(), IsFavorite = true })
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

    private sealed class TestMovie : Movie
    {
        public override SourceType SourceType => SourceType.Library;

        public override string GetClientTypeName() => nameof(Movie);
    }

    private static object? GetDefaultValue(Type? type)
        => type is not null && type.IsValueType ? Activator.CreateInstance(type) : null;
}
