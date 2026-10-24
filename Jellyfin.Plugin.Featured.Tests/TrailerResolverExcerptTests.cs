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
    [InlineData(FeaturedMediaExcerptModes.Always, 0, new[] { "excerpt", "local", "remote" })]
    [InlineData(FeaturedMediaExcerptModes.Always, 1, new[] { "manual", "excerpt", "remote" })]
    [InlineData(FeaturedMediaExcerptModes.PreferOverRemote, 0, new[] { "local", "excerpt", "remote" })]
    [InlineData(FeaturedMediaExcerptModes.Fallback, 0, new[] { "local", "remote", "excerpt" })]
    public void ExcerptIsPlacedAccordingToMode(string mode, int manualCount, string[] expected)
    {
        List<FeaturedTrailerDto> candidates = manualCount == 1
            ? [Candidate("manual", "remote"), Candidate("remote", "remote")]
            : [Candidate("local", "local"), Candidate("remote", "remote")];

        TrailerResolver.InsertExcerpt(candidates, Candidate("excerpt", "local"), mode, manualCount);

        Assert.Equal(expected, candidates.Select(candidate => candidate.Name));
    }

    [Fact]
    public void PreferOverRemoteAppendsWhenOnlyLocalTrailersExist()
    {
        List<FeaturedTrailerDto> candidates = [Candidate("local", "local")];

        TrailerResolver.InsertExcerpt(candidates, Candidate("excerpt", "local"), FeaturedMediaExcerptModes.PreferOverRemote, 0);

        Assert.Equal(["local", "excerpt"], candidates.Select(candidate => candidate.Name));
    }

    [Fact]
    public void ResolverOffersNoExcerptByDefault()
    {
        BaseItem movie = CreateMovie(TimeSpan.FromHours(2));
        PluginConfiguration config = RemoteOnly();

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
            // Local trailer lookup needs a full library; these tests only cover excerpt placement.
            TrailerSourcePriority = FeaturedTrailerSourcePriorities.RemoteOnly,
            MediaExcerptMode = FeaturedMediaExcerptModes.Always,
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
        PluginConfiguration config = RemoteOnly(FeaturedMediaExcerptModes.Always);

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
        PluginConfiguration config = RemoteOnly(FeaturedMediaExcerptModes.Fallback);

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
            MediaExcerptMode = "sometimes",
            MediaExcerptWindowStartMinutes = 20,
            MediaExcerptWindowEndMinutes = 10,
            MediaExcerptDurationSeconds = 900,
            Presets =
            [
                new FeaturedPreset
                {
                    Trailers = new FeaturedPresetTrailerSettings
                    {
                        MediaExcerptMode = FeaturedMediaExcerptModes.PreferOverRemote,
                        MediaExcerptWindowStartMinutes = -5,
                        MediaExcerptDurationSeconds = 1
                    }
                }
            ]
        };

        PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal(FeaturedMediaExcerptModes.Off, config.MediaExcerptMode);
        Assert.Equal(20, config.MediaExcerptWindowStartMinutes);
        Assert.Equal(20, config.MediaExcerptWindowEndMinutes);
        Assert.Equal(FeaturedMediaExcerptModes.MaximumDurationSeconds, config.MediaExcerptDurationSeconds);
        FeaturedPresetTrailerSettings preset = config.Presets.Single().Trailers;
        Assert.Equal(FeaturedMediaExcerptModes.PreferOverRemote, preset.MediaExcerptMode);
        Assert.Equal(0, preset.MediaExcerptWindowStartMinutes);
        Assert.Equal(FeaturedMediaExcerptModes.MinimumDurationSeconds, preset.MediaExcerptDurationSeconds);
    }

    private static PluginConfiguration RemoteOnly(string mode = FeaturedMediaExcerptModes.Off) => new()
    {
        TrailerSourcePriority = FeaturedTrailerSourcePriorities.RemoteOnly,
        MediaExcerptMode = mode
    };

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
