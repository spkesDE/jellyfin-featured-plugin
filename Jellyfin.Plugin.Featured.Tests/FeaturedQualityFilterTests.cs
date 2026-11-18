using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Model.Entities;
using Jellyfin.Plugin.Featured.Api;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedQualityFilterTests
{
    [Theory]
    [InlineData(FeaturedFilterFields.HasTrailer, FeaturedFilterOperators.Equal)]
    [InlineData(FeaturedFilterFields.HasLogo, FeaturedFilterOperators.NotEquals)]
    [InlineData(FeaturedFilterFields.HasBackdrop, FeaturedFilterOperators.Equal)]
    [InlineData(FeaturedFilterFields.Studio, FeaturedFilterOperators.ContainsAll)]
    [InlineData(FeaturedFilterFields.DaysSinceAdded, FeaturedFilterOperators.LessThanOrEqual)]
    [InlineData(FeaturedFilterFields.VideoRange, FeaturedFilterOperators.ContainsAny)]
    [InlineData(FeaturedFilterFields.SeriesStatus, FeaturedFilterOperators.NotEquals)]
    [InlineData(FeaturedFilterFields.Actor, FeaturedFilterOperators.ContainsAll)]
    [InlineData(FeaturedFilterFields.AudioLanguage, FeaturedFilterOperators.ContainsAll)]
    public void NormalizerKeepsNewFieldsAndTheirOperators(string field, string filterOperator)
    {
        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(new PluginConfiguration
        {
            GlobalFilters = [new FeaturedFilterRule { Field = field, Operator = filterOperator, Values = ["x"] }]
        });

        FeaturedFilterRule filter = Assert.Single(normalized.GlobalFilters);
        Assert.Equal(field, filter.Field);
        Assert.Equal(filterOperator, filter.Operator);
    }

    [Fact]
    public void TrailerFilterSeesTrailerLinksWithoutALibraryLookup()
    {
        Photo withoutTrailerSupport = new() { Id = Guid.NewGuid() };
        Movie withRemoteTrailer = new()
        {
            Id = Guid.NewGuid(),
            RemoteTrailers = [new MediaUrl { Url = "https://www.youtube.com/watch?v=x" }]
        };

        Assert.False(FeaturedRuleEngine.HasTrailer(withoutTrailerSupport));
        Assert.True(FeaturedRuleEngine.HasTrailer(withRemoteTrailer));
    }

    [Fact]
    public void DaysSinceAddedCountsFromTheLibraryDate()
    {
        Movie recent = new() { Id = Guid.NewGuid(), DateCreated = DateTime.UtcNow.AddDays(-3) };
        Movie unknown = new() { Id = Guid.NewGuid(), DateCreated = default };

        Assert.InRange(FeaturedRuleEngine.GetDaysSinceAdded(recent)!.Value, 2.9, 3.1);
        Assert.Null(FeaturedRuleEngine.GetDaysSinceAdded(unknown));
    }
}
