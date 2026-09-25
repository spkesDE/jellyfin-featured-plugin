using System.Reflection;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.TV;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedRuleEngineAllocationTests : FeaturedPreparedCacheTestBase
{
    [Fact]
    public void UserWithOnlyOneEnabledSourceFillsFeedPastItsMixerMaximum()
    {
        PluginConfiguration config = CreateConfig(
            new FeaturedSourceRule
            {
                Id = "only-source",
                Type = FeaturedSourceTypes.Random,
                MaximumItems = 1
            },
            new FeaturedSourceRule
            {
                Id = "disabled-source",
                Type = FeaturedSourceTypes.Random,
                MaximumItems = 1
            });
        FeaturedPersonalizationContext personalization = CreatePersonalization() with
        {
            SourceRules =
            [
                config.SourceRules[0],
                new FeaturedSourceRule
                {
                    Id = "disabled-source",
                    Type = FeaturedSourceTypes.Random,
                    Enabled = false,
                    MaximumItems = 1
                }
            ]
        };
        _libraryManager.Candidates.AddRange(CreateItems(5));

        FeaturedSelection selection = CreateEngine(config).SelectItems(
            _user,
            [],
            new Dictionary<Guid, DateTimeOffset>(),
            5,
            personalization);

        Assert.Equal(5, selection.Items.Count);
        Assert.Equal(5, Assert.Single(selection.RuleStats).Returned);
    }

    [Fact]
    public void MultipleAvailableSourcesKeepTheirMixerMaximums()
    {
        PluginConfiguration config = CreateConfig(
            new FeaturedSourceRule
            {
                Id = "first-source",
                Type = FeaturedSourceTypes.Random,
                MaximumItems = 1
            },
            new FeaturedSourceRule
            {
                Id = "second-source",
                Type = FeaturedSourceTypes.Random,
                MaximumItems = 1
            });
        _libraryManager.Candidates.AddRange(CreateItems(5));

        FeaturedSelection selection = CreateEngine(config).SelectItems(
            _user,
            [],
            new Dictionary<Guid, DateTimeOffset>(),
            5);

        Assert.Equal(2, selection.Items.Count);
        Assert.All(selection.RuleStats, stats => Assert.Equal(1, stats.Returned));
    }

    private static PluginConfiguration CreateConfig(params FeaturedSourceRule[] rules)
        => PluginConfigurationNormalizer.Normalize(new PluginConfiguration
        {
            SourceRules = rules,
            RepeatCooldownDays = 0
        });

    private FeaturedRuleEngine CreateEngine(PluginConfiguration config)
    {
        FeaturedMediaMetadataService mediaMetadata = new(
            _libraryManagerService,
            DispatchProxy.Create<IMediaSourceManager, EmptyServiceStub>(),
            DispatchProxy.Create<ITVSeriesManager, EmptyServiceStub>());
        return new FeaturedRuleEngine(
            config,
            _userManager,
            _libraryManagerService,
            _userDataManager,
            new FeaturedCandidateCache(),
            new FeaturedRecommendationCandidates(
                DispatchProxy.Create<ISimilarItemsManager, SimilarItemsManagerStub>(),
                NullLogger<FeaturedRecommendationCandidates>.Instance),
            mediaMetadata);
    }
}
