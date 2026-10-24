using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Model.Entities;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class TrailerResolverExcerptTests : FeaturedPreparedCacheTestBase
{
    private const string YouTubeUrl = "https://www.youtube.com/watch?v=example12345";
    private static readonly string[] ExcerptOnly = [FeaturedMediaPriorityTypes.MediaExcerpt];

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
    [InlineData(FeaturedTrailerSourcePriorities.LocalRemoteExcerpt, "local_trailer,remote_trailer,media_excerpt")]
    [InlineData(FeaturedTrailerSourcePriorities.LocalExcerptRemote, "local_trailer,media_excerpt,remote_trailer")]
    [InlineData(FeaturedTrailerSourcePriorities.ExcerptOnly, "media_excerpt")]
    [InlineData(FeaturedTrailerSourcePriorities.PreferLocal, "local_trailer,remote_trailer")]
    [InlineData(FeaturedTrailerSourcePriorities.Automatic, "local_trailer,remote_trailer")]
    [InlineData(FeaturedTrailerSourcePriorities.PreferRemote, "remote_trailer,local_trailer")]
    [InlineData(FeaturedTrailerSourcePriorities.LocalOnly, "local_trailer")]
    [InlineData(FeaturedTrailerSourcePriorities.RemoteOnly, "remote_trailer")]
    public void TrailerSourcePriorityMapsToMediaPriority(string priority, string expected)
    {
        FeaturedMediaPriorityEntry[] entries = FeaturedMediaPriorityTypes.FromTrailerSourcePriority(priority);

        Assert.Equal(expected.Split(','), FeaturedMediaPriorityTypes.EnabledTypes(entries));
        Assert.Equal(FeaturedMediaPriorityTypes.All.Order(), entries.Select(entry => entry.Type).Order());
    }

    [Fact]
    public void ResolverFollowsMediaPriorityOrder()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = new()
        {
            TrailerOverrides = [new FeaturedTrailerOverride { ItemId = movie.Id.ToString(), Url = YouTubeUrl }]
        };

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(
                movie,
                _user,
                config,
                [FeaturedMediaPriorityTypes.Trickplay, FeaturedMediaPriorityTypes.MediaExcerpt],
                true);

        Assert.Equal(
            ["youtube", "trickplay", TrailerResolver.MediaExcerptProvider],
            candidates.Select(candidate => candidate.Provider));
    }

    [Fact]
    public void ResolverSkipsTrailersButKeepsVideoFallbacksWhenTrailersAreOff()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = new()
        {
            TrailerOverrides = [new FeaturedTrailerOverride { ItemId = movie.Id.ToString(), Url = YouTubeUrl }]
        };

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(
                movie,
                _user,
                config,
                [FeaturedMediaPriorityTypes.RemoteTrailer, FeaturedMediaPriorityTypes.Trickplay],
                false);

        Assert.Equal(["trickplay"], candidates.Select(candidate => candidate.Provider));
    }

    [Fact]
    public void ResolverOffersNoExcerptByDefault()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, new PluginConfiguration(), [FeaturedMediaPriorityTypes.RemoteTrailer], true);

        Assert.DoesNotContain(candidates, candidate => candidate.Provider == TrailerResolver.MediaExcerptProvider);
    }

    [Fact]
    public void ResolverAddsMovieExcerptAfterManualOverride()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = new()
        {
            MediaExcerptDurationSeconds = 45,
            TrailerOverrides = [new FeaturedTrailerOverride { ItemId = movie.Id.ToString(), Url = YouTubeUrl }]
        };

        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, config, ExcerptOnly, true);

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
        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(movie, _user, new PluginConfiguration(), ExcerptOnly, true);

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
        IReadOnlyList<FeaturedTrailerDto> candidates = new TrailerResolver(_libraryManagerService)
            .ResolveCandidates(series, _user, new PluginConfiguration(), ExcerptOnly, true);

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

    private static BaseItem CreateMovie(TimeSpan? runtime) => new TestMovie
    {
        Id = Guid.NewGuid(),
        Name = "Movie",
        Path = "/media/movie.mkv",
        RunTimeTicks = runtime?.Ticks,
        ImageInfos = [new ItemImageInfo { Path = "/images/movie.jpg", Type = ImageType.Primary }]
    };
}
