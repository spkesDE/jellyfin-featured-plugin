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

    /// <summary>Applies a read-modify-write under the store lock; returning null removes the user's entry.</summary>
    internal FeaturedUserPreferences? Update(Guid userId, Func<FeaturedUserPreferences?, FeaturedUserPreferences?> update)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            string key = userId.ToString("N");
            FeaturedUserPreferences? current = _preferences!.TryGetValue(key, out FeaturedUserPreferences? value)
                ? value.Copy()
                : null;
            FeaturedUserPreferences? updated = update(current);
            if (updated is null)
            {
                if (_preferences.Remove(key)) Save();
                return null;
            }

            _preferences[key] = updated.Copy();
            Save();
            return updated.Copy();
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

    /// <summary>Lists every user that has stored entries, for removing the data of deleted users.</summary>
    internal Guid[] GetUserIds()
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            return _preferences!.Keys
                .Select(key => Guid.TryParse(key, out Guid id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToArray();
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

    /// <summary>Remembered trailer mute state; unlike the other display flags both values are stored explicitly.</summary>
    public bool? StartTrailersMuted { get; set; }

    /// <summary>Remembered trailer volume (0-100); null keeps the browser's own volume.</summary>
    public int? TrailerVolume { get; set; }

    /// <summary>
    /// False keeps player mute and volume changes for the page session only; the saved values above stay the
    /// user's defaults. Only false is stored, because saving automatically is the default.
    /// </summary>
    public bool? AutoSaveTrailerAudio { get; set; }

    internal FeaturedUserDisplayPreferences Copy() => new()
    {
        EnableBackgroundTrailers = EnableBackgroundTrailers,
        ShowRating = ShowRating,
        ShowDescription = ShowDescription,
        ShowYear = ShowYear,
        ShowRuntime = ShowRuntime,
        ShowFavoriteButton = ShowFavoriteButton,
        ShowPlaystateButton = ShowPlaystateButton,
        ShowDismissalButton = ShowDismissalButton,
        StartTrailersMuted = StartTrailersMuted,
        TrailerVolume = TrailerVolume,
        AutoSaveTrailerAudio = AutoSaveTrailerAudio
    };

    internal bool IsEmpty()
        => !EnableBackgroundTrailers.HasValue
            && !ShowRating.HasValue
            && !ShowDescription.HasValue
            && !ShowYear.HasValue
            && !ShowRuntime.HasValue
            && !ShowFavoriteButton.HasValue
            && !ShowPlaystateButton.HasValue
            && !ShowDismissalButton.HasValue
            && !StartTrailersMuted.HasValue
            && !TrailerVolume.HasValue
            && !AutoSaveTrailerAudio.HasValue;
}
