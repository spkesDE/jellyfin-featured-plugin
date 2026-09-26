using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferencesResponse
{
    internal FeaturedPreferencesResponse(
        FeaturedUserPreferences? saved,
        FeaturedPersonalizationContext effective,
        FeaturedPersonalizationContext defaults)
    {
        HasOverrides = saved is not null;
        Preferences = saved ?? new FeaturedUserPreferences();
        Effective = new FeaturedEffectivePreferences
        {
            SourceEnabled = effective.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Enabled),
            SourceWeights = effective.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Weight),
            PreferredGenres = effective.Profile.PreferredGenres,
            ExcludedGenres = effective.ExcludedGenres,
            UnplayedBoost = effective.Profile.UnplayedBoost,
            FavouriteBoost = effective.Profile.FavouriteBoost,
            InProgressSeriesBoost = effective.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = (int)Math.Ceiling(effective.RepeatCooldownHours / 24d),
            RepeatCooldownHours = effective.RepeatCooldownHours,
            Display = effective.Display
        };
        Defaults = new FeaturedEffectivePreferences
        {
            SourceEnabled = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Enabled),
            SourceWeights = defaults.SourceRules.ToDictionary(rule => rule.Id, rule => rule.Weight),
            PreferredGenres = defaults.Profile.PreferredGenres,
            ExcludedGenres = defaults.ExcludedGenres,
            UnplayedBoost = defaults.Profile.UnplayedBoost,
            FavouriteBoost = defaults.Profile.FavouriteBoost,
            InProgressSeriesBoost = defaults.Profile.InProgressSeriesBoost,
            RepeatCooldownDays = (int)Math.Ceiling(defaults.RepeatCooldownHours / 24d),
            RepeatCooldownHours = defaults.RepeatCooldownHours,
            Display = defaults.Display
        };
    }

    public bool HasOverrides { get; }
    public FeaturedUserPreferences Preferences { get; }
    public FeaturedEffectivePreferences Effective { get; }
    public FeaturedEffectivePreferences Defaults { get; }
}

public sealed class FeaturedEffectivePreferences
{
    public Dictionary<string, bool> SourceEnabled { get; set; } = [];
    public Dictionary<string, int> SourceWeights { get; set; } = [];
    public string[] PreferredGenres { get; set; } = [];
    public string[] ExcludedGenres { get; set; } = [];
    public int UnplayedBoost { get; set; }
    public int FavouriteBoost { get; set; }
    public int InProgressSeriesBoost { get; set; }
    public int RepeatCooldownDays { get; set; }
    public int RepeatCooldownHours { get; set; }
    public FeaturedDisplayPreferences Display { get; set; } = new(false, false, false, false, false, false);
}

public sealed class FeaturedPreferencesUpdate
{
    public bool Reset { get; set; }
    public FeaturedUserPreferences? Preferences { get; set; }
}

public sealed class FeaturedPreferenceOptionsResponse
{
    internal FeaturedPreferenceOptionsResponse(FeaturedPersonalizationPolicy policy, FeaturedPreferenceSourceOption[] sources, string[] genres)
    {
        Policy = policy;
        Sources = sources;
        Genres = genres;
    }

    public FeaturedPersonalizationPolicy Policy { get; }
    public FeaturedPreferenceSourceOption[] Sources { get; }
    public string[] Genres { get; }
}

public sealed class FeaturedPreferencesBootstrapResponse
{
    internal FeaturedPreferencesBootstrapResponse(
        FeaturedPreferencesResponse current,
        FeaturedPreferenceOptionsResponse options,
        FeaturedDismissalsResponse dismissals)
    {
        Current = current;
        Options = options;
        Dismissals = dismissals;
    }

    public FeaturedPreferencesResponse Current { get; }
    public FeaturedPreferenceOptionsResponse Options { get; }
    public FeaturedDismissalsResponse Dismissals { get; }
}

public sealed class FeaturedDismissalsResponse
{
    internal FeaturedDismissalsResponse(FeaturedDismissalPolicy policy, IReadOnlyList<FeaturedDismissalEntry> entries)
    {
        Policy = policy;
        Entries = entries;
    }

    public FeaturedDismissalPolicy Policy { get; }
    public IReadOnlyList<FeaturedDismissalEntry> Entries { get; }
}

public sealed class FeaturedDismissalMutationResponse
{
    public required FeaturedDismissalEntry Dismissal { get; init; }
}

public sealed class FeaturedPreferenceSourceOption
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public int Weight { get; set; }
}
