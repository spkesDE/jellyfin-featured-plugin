using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferenceStore
{
    private const string ConfigurationDirectoryName = "Jellyfin.Plugin.Featured";
    private readonly object _syncRoot = new();
    private readonly AtomicJsonFileStore<Dictionary<string, FeaturedUserPreferences>> _persistence;
    private Dictionary<string, FeaturedUserPreferences>? _preferences;

    public FeaturedPreferenceStore(IApplicationPaths applicationPaths, ILogger<FeaturedPreferenceStore> logger)
    {
        string filePath = Path.Combine(applicationPaths.PluginConfigurationsPath, ConfigurationDirectoryName, "user-preferences.json");
        _persistence = new(filePath, "user preferences", logger);
    }

    internal FeaturedUserPreferences? Get(Guid userId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            return _preferences!.TryGetValue(userId.ToString("N"), out FeaturedUserPreferences? value)
                ? value.Copy()
                : null;
        }
    }

    internal void Set(Guid userId, FeaturedUserPreferences preferences)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            _preferences![userId.ToString("N")] = preferences.Copy();
            Save();
        }
    }

    internal void Remove(Guid userId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            if (_preferences!.Remove(userId.ToString("N"))) Save();
        }
    }

    private void EnsureLoaded()
    {
        if (_preferences is not null) return;
        _preferences = _persistence.Load(
            () => new(StringComparer.OrdinalIgnoreCase),
            loaded => new Dictionary<string, FeaturedUserPreferences>(loaded, StringComparer.OrdinalIgnoreCase));
    }

    private void Save()
    {
        _persistence.Save(_preferences!);
    }
}

public sealed class FeaturedUserPreferences
{
    public Dictionary<string, bool> SourceEnabled { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> SourceWeights { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public FeaturedUserDisplayPreferences Display { get; set; } = new();
    public string[]? PreferredGenres { get; set; }
    public string[]? ExcludedGenres { get; set; }
    public int? UnplayedBoost { get; set; }
    public int? FavouriteBoost { get; set; }
    public int? InProgressSeriesBoost { get; set; }
    public int? RepeatCooldownDays { get; set; }
    public int? RepeatCooldownHours { get; set; }

    internal FeaturedUserPreferences Copy() => new()
    {
        SourceEnabled = new Dictionary<string, bool>(SourceEnabled ?? [], StringComparer.OrdinalIgnoreCase),
        SourceWeights = new Dictionary<string, int>(SourceWeights ?? [], StringComparer.OrdinalIgnoreCase),
        Display = Display?.Copy() ?? new FeaturedUserDisplayPreferences(),
        PreferredGenres = PreferredGenres?.ToArray(),
        ExcludedGenres = ExcludedGenres?.ToArray(),
        UnplayedBoost = UnplayedBoost,
        FavouriteBoost = FavouriteBoost,
        InProgressSeriesBoost = InProgressSeriesBoost,
        RepeatCooldownDays = RepeatCooldownDays,
        RepeatCooldownHours = RepeatCooldownHours
    };
}

public sealed class FeaturedUserDisplayPreferences
{
    public bool? EnableBackgroundTrailers { get; set; }
    public bool? ShowRating { get; set; }
    public bool? ShowDescription { get; set; }
    public bool? ShowYear { get; set; }
    public bool? ShowRuntime { get; set; }
    public bool? ShowFavoriteButton { get; set; }
    public bool? ShowPlaystateButton { get; set; }
    public bool? ShowDismissalButton { get; set; }

    internal FeaturedUserDisplayPreferences Copy() => new()
    {
        EnableBackgroundTrailers = EnableBackgroundTrailers,
        ShowRating = ShowRating,
        ShowDescription = ShowDescription,
        ShowYear = ShowYear,
        ShowRuntime = ShowRuntime,
        ShowFavoriteButton = ShowFavoriteButton,
        ShowPlaystateButton = ShowPlaystateButton,
        ShowDismissalButton = ShowDismissalButton
    };

    internal bool IsEmpty()
        => !EnableBackgroundTrailers.HasValue
            && !ShowRating.HasValue
            && !ShowDescription.HasValue
            && !ShowYear.HasValue
            && !ShowRuntime.HasValue
            && !ShowFavoriteButton.HasValue
            && !ShowPlaystateButton.HasValue
            && !ShowDismissalButton.HasValue;
}
