using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Model.Entities;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class TrailerResolverExcerptTests : FeaturedPreparedCacheTestBase
{
    private const string YouTubeUrl = "https://www.youtube.com/watch?v=example12345";

    [Theory]
    [InlineData(0d, 300)]
    [InlineData(0.5d, 600)]
    [InlineData(1d, 900)]
    public void ExcerptStartStaysInsideConfiguredWindow(double random, int expected)
    {
        Assert.Equal(expected, TrailerResolver.ComputeExcerptStartSeconds(7200, 5, 15, 30, random));
    }

    [Fact]
    public void ExcerptWindowScalesDownForShortItems()
    {
        // 10 minutes runtime: the last full 30 s excerpt starts at 570 s, so 5–15 min maps to 190–570 s.
        Assert.Equal(190, TrailerResolver.ComputeExcerptStartSeconds(600, 5, 15, 30, 0));
        Assert.Equal(570, TrailerResolver.ComputeExcerptStartSeconds(600, 5, 15, 30, 1));
    }

    [Fact]
    public void ExcerptIsSkippedWhenItemIsShorterThanTheExcerpt()
    {
        Assert.Null(TrailerResolver.ComputeExcerptStartSeconds(25, 5, 15, 30, 0.5));
        Assert.Null(TrailerResolver.ComputeExcerptStartSeconds(double.NaN, 5, 15, 30, 0.5));
    }

    [Fact]
    public void ZeroWidthWindowUsesFixedStart()
    {
        Assert.Equal(480, TrailerResolver.ComputeExcerptStartSeconds(7200, 8, 8, 30, 0.9));
    }

    [Theory]
    [InlineData(FeaturedTrailerSourcePriorities.LocalRemoteExcerpt, new[] { "local", "remote", "excerpt" })]
    [InlineData(FeaturedTrailerSourcePriorities.LocalExcerptRemote, new[] { "local", "excerpt", "remote" })]
    [InlineData(FeaturedTrailerSourcePriorities.ExcerptOnly, new[] { "excerpt" })]
    [InlineData(FeaturedTrailerSourcePriorities.PreferLocal, new[] { "local", "remote" })]
    [InlineData(FeaturedTrailerSourcePriorities.Automatic, new[] { "local", "remote" })]
    [InlineData(FeaturedTrailerSourcePriorities.PreferRemote, new[] { "remote", "local" })]
    public void SourcePriorityOrdersExcerptWithTrailers(string priority, string[] expected)
    {
        List<FeaturedTrailerDto> candidates = [];

        TrailerResolver.AddBySourcePriority(
            candidates,
            priority,
            [Candidate("local", "local")],
            [Candidate("remote", "remote")],
            [Candidate("excerpt", "local")]);

        Assert.Equal(expected, candidates.Select(candidate => candidate.Name));
    }

    [Theory]
    [InlineData(FeaturedTrailerSourcePriorities.LocalRemoteExcerpt, true)]
    [InlineData(FeaturedTrailerSourcePriorities.LocalExcerptRemote, true)]
    [InlineData(FeaturedTrailerSourcePriorities.ExcerptOnly, true)]
    [InlineData(FeaturedTrailerSourcePriorities.PreferLocal, false)]
    [InlineData(FeaturedTrailerSourcePriorities.Automatic, false)]
    public void OnlyExcerptSourcesIncludeExcerpts(string priority, bool expected)
    {
        Assert.Equal(expected, FeaturedTrailerSourcePriorities.IncludesExcerpt(priority));
    }

    [Fact]
    public void ResolverOffersNoExcerptByDefault()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = WithSource(FeaturedTrailerSourcePriorities.RemoteOnly);

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, config);

        Assert.DoesNotContain(candidates, candidate => candidate.Provider == TrailerResolver.MediaExcerptProvider);
    }

    [Fact]
    public void ResolverAddsMovieExcerptAfterManualOverride()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = new()
        {
            TrailerSourcePriority = FeaturedTrailerSourcePriorities.ExcerptOnly,
            MediaExcerptDurationSeconds = 45,
            TrailerOverrides = [new FeaturedTrailerOverride { ItemId = movie.Id.ToString(), Url = YouTubeUrl }]
        };

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, config);

        Assert.Equal(["youtube", TrailerResolver.MediaExcerptProvider], candidates.Select(candidate => candidate.Provider));
        FeaturedTrailerDto excerpt = candidates[1];
        Assert.Equal(movie.Id.ToString(), excerpt.ItemId);
        Assert.Equal(45, excerpt.DurationSeconds);
        Assert.InRange(excerpt.StartSeconds!.Value, 300, 900);
    }

    [Fact]
    public void ResolverSkipsExcerptWithoutRuntime()
    {
        BaseItem movie = CreateMovie(null);
        PluginConfiguration config = WithSource(FeaturedTrailerSourcePriorities.ExcerptOnly);

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, config);

        Assert.Empty(candidates);
    }

    [Fact]
    public void SeriesExcerptPlaysFirstRegularEpisode()
    {
        Series series = new() { Id = Guid.NewGuid(), Name = "Series" };
        Episode episode = new()
        {
            Id = Guid.NewGuid(),
            Name = "Pilot",
            ParentIndexNumber = 1,
            IndexNumber = 1,
            RunTimeTicks = TimeSpan.FromMinutes(45).Ticks
        };
        _libraryManager.Candidates.Add(episode);
        PluginConfiguration config = WithSource(FeaturedTrailerSourcePriorities.ExcerptOnly);

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(series, _user, config);

        FeaturedTrailerDto excerpt = Assert.Single(candidates, candidate => candidate.Provider == TrailerResolver.MediaExcerptProvider);
        Assert.Equal(episode.Id.ToString(), excerpt.ItemId);
    }

    [Fact]
    public void NormalizerClampsExcerptSettings()
    {
        PluginConfiguration config = new()
        {
            TrailerSourcePriority = "sometimes",
            MediaExcerptWindowStartMinutes = 20,
            MediaExcerptWindowEndMinutes = 10,
            MediaExcerptDurationSeconds = 900,
            Presets =
            [
                new FeaturedPreset
                {
                    Trailers = new FeaturedPresetTrailerSettings
                    {
                        TrailerSourcePriority = FeaturedTrailerSourcePriorities.LocalExcerptRemote,
                        MediaExcerptWindowStartMinutes = -5,
                        MediaExcerptDurationSeconds = 1
                    }
                }
            ]
        };

        PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal(FeaturedTrailerSourcePriorities.PreferLocal, config.TrailerSourcePriority);
        Assert.Equal(20, config.MediaExcerptWindowStartMinutes);
        Assert.Equal(20, config.MediaExcerptWindowEndMinutes);
        Assert.Equal(FeaturedMediaExcerptLimits.MaximumDurationSeconds, config.MediaExcerptDurationSeconds);
        FeaturedPresetTrailerSettings preset = config.Presets.Single().Trailers;
        Assert.Equal(FeaturedTrailerSourcePriorities.LocalExcerptRemote, preset.TrailerSourcePriority);
        Assert.Equal(0, preset.MediaExcerptWindowStartMinutes);
        Assert.Equal(FeaturedMediaExcerptLimits.MinimumDurationSeconds, preset.MediaExcerptDurationSeconds);
    }

    // Local trailer lookup needs a full library, so resolver tests avoid sources that query local trailers.
    private static PluginConfiguration WithSource(string priority) => new() { TrailerSourcePriority = priority };

    private static FeaturedTrailerDto Candidate(string name, string type) => new()
    {
        Type = type,
        Provider = type == "remote" ? "youtube" : "jellyfin",
        Name = name,
        ItemId = Guid.NewGuid().ToString()
    };

    private static BaseItem CreateMovie(TimeSpan? runtime) => new TestMovie
    {
        Id = Guid.NewGuid(),
        Name = "Movie",
        Path = "/media/movie.mkv",
        RunTimeTicks = runtime?.Ticks,
        ImageInfos = [new ItemImageInfo { Path = "/images/movie.jpg", Type = ImageType.Primary }]
    };
}
