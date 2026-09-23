using System.Reflection;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.TV;
using MediaBrowser.Model.Querying;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedRoadmapFilterTests
{
    [Fact]
    public void NormalizerKeepsContinueWatchingAndNextUpSources()
    {
        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(new PluginConfiguration
        {
            SourceRules =
            [
                new FeaturedSourceRule { Type = FeaturedSourceTypes.ContinueWatching },
                new FeaturedSourceRule { Type = FeaturedSourceTypes.NextUp }
            ]
        });

        Assert.Equal(
            [FeaturedSourceTypes.ContinueWatching, FeaturedSourceTypes.NextUp],
            normalized.SourceRules.Select(rule => rule.Type));
    }

    [Theory]
    [InlineData(FeaturedFilterFields.Actor)]
    [InlineData(FeaturedFilterFields.Director)]
    [InlineData(FeaturedFilterFields.OriginalLanguage)]
    [InlineData(FeaturedFilterFields.AudioLanguage)]
    public void NormalizerKeepsPeopleAndLanguageFilters(string field)
    {
        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(new PluginConfiguration
        {
            GlobalFilters = [new FeaturedFilterRule { Field = field, Values = ["example"] }]
        });

        Assert.Equal(field, Assert.Single(normalized.GlobalFilters).Field);
    }

    [Fact]
    public void MissingMetadataHasExplicitIncludeAndExcludeBehavior()
    {
        Assert.False(FeaturedRuleEngine.MatchMetadataCollection(
            [], ["deu"], FeaturedFilterOperators.ContainsAny));
        Assert.True(FeaturedRuleEngine.MatchMetadataCollection(
            [], ["deu"], FeaturedFilterOperators.NotEquals));
    }

    [Fact]
    public void MetadataFiltersAreCaseInsensitiveAndSupportAllValues()
    {
        Assert.True(FeaturedRuleEngine.MatchMetadataCollection(
            ["English", "German"], ["english"], FeaturedFilterOperators.ContainsAny));
        Assert.True(FeaturedRuleEngine.MatchMetadataCollection(
            ["English", "German"], ["ENGLISH", "GERMAN"], FeaturedFilterOperators.ContainsAll));
        Assert.True(FeaturedRuleEngine.MatchMetadataCollection(
            ["English"], ["German"], FeaturedFilterOperators.NotEquals));
    }

    [Fact]
    public void ContinueWatchingUsesAUserScopedResumableQuery()
    {
        User user = new("continue-test", "auth", "reset");
        ILibraryManager libraryManager = DispatchProxy.Create<ILibraryManager, LibraryManagerStub>();
        LibraryManagerStub stub = (LibraryManagerStub)libraryManager;
        FeaturedMediaMetadataService service = CreateService(libraryManager, out _);

        _ = service.GetContinueWatching(user, 25);

        InternalItemsQuery query = Assert.IsType<InternalItemsQuery>(stub.LastQuery);
        Assert.Same(user, query.User);
        Assert.True(query.IsResumable);
        Assert.Equal(25, query.Limit);
        Assert.Contains(BaseItemKind.Episode, query.IncludeItemTypes);
        Assert.Contains(query.OrderBy, order => order.Item1 == ItemSortBy.DatePlayed && order.Item2 == SortOrder.Descending);
    }

    [Fact]
    public void NextUpDelegatesToJellyfinForTheActiveUser()
    {
        User user = new("next-up-test", "auth", "reset");
        ILibraryManager libraryManager = DispatchProxy.Create<ILibraryManager, LibraryManagerStub>();
        FeaturedMediaMetadataService service = CreateService(libraryManager, out TvSeriesManagerStub tv);

        _ = service.GetNextUp(user, 15);

        NextUpQuery query = Assert.IsType<NextUpQuery>(tv.LastQuery);
        Assert.Same(user, query.User);
        Assert.Equal(15, query.Limit);
        Assert.True(query.EnableResumable);
        Assert.False(query.EnableRewatching);
    }

    private static FeaturedMediaMetadataService CreateService(
        ILibraryManager libraryManager,
        out TvSeriesManagerStub tv)
    {
        ITVSeriesManager tvManager = DispatchProxy.Create<ITVSeriesManager, TvSeriesManagerStub>();
        tv = (TvSeriesManagerStub)tvManager;
        return new FeaturedMediaMetadataService(
            libraryManager,
            DispatchProxy.Create<IMediaSourceManager, EmptyServiceStub>(),
            tvManager);
    }

    public class LibraryManagerStub : DispatchProxy
    {
        public InternalItemsQuery? LastQuery { get; private set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ILibraryManager.GetItemList))
            {
                LastQuery = (InternalItemsQuery)args![0]!;
                return new List<BaseItem>();
            }

            return Default(targetMethod?.ReturnType);
        }
    }

    public class TvSeriesManagerStub : DispatchProxy
    {
        public NextUpQuery? LastQuery { get; private set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ITVSeriesManager.GetNextUp))
            {
                LastQuery = (NextUpQuery)args![0]!;
                return new QueryResult<BaseItem>([]);
            }

            return Default(targetMethod?.ReturnType);
        }
    }

    public class EmptyServiceStub : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => Default(targetMethod?.ReturnType);
    }

    private static object? Default(Type? type)
        => type is not null && type.IsValueType ? Activator.CreateInstance(type) : null;
}
