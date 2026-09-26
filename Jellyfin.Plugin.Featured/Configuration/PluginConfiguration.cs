using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Featured;

public sealed partial class PluginConfiguration : BasePluginConfiguration
{
    public string FrontendInjectionMethod { get; set; } = FrontendInjectionMethods.Automatic;

    public bool EnableFrontendBootstrap { get; set; } = true;

    public FeaturedSourceRule[] SourceRules { get; set; } =
    [
        new FeaturedSourceRule
        {
            Id = "default-random",
            Type = FeaturedSourceTypes.Random,
            Enabled = true,
            Weight = 100
        }
    ];

    public FeaturedFilterRule[] GlobalFilters { get; set; } = [];

    public FeaturedManualList[] ManualLists { get; set; } = [];

    public FeaturedUserProfile[] UserProfiles { get; set; } = [];

    public FeaturedPersonalizationDefaults PersonalizationDefaults { get; set; } = new();

    public FeaturedPersonalizationPolicy PersonalizationPolicy { get; set; } = new();

    public FeaturedDismissalPolicy DismissalPolicy { get; set; } = new();

    public FeaturedPreset[] Presets { get; set; } = [];

    public int RepeatCooldownDays { get; set; } = 1;

    public bool RelaxRepeatCooldownWhenNeeded { get; set; } = false;

    public int MaximumItemsPerGenre { get; set; } = 0;

    public int MaximumItemsPerFranchise { get; set; } = 0;

    public int RandomMediaCount { get; set; } = 5;

    public bool EnableInfiniteLoading { get; set; }

    public int MaximumParentRating { get; set; } = -2;

    public int MaximumParentRatingSubscore { get; set; }

    public bool ReduceImageSize { get; set; }

    public bool EnablePreparedCache { get; set; } = true;

    public bool Debug { get; set; }
}
