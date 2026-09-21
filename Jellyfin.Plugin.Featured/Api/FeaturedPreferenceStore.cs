using System.Text.Json;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferenceStore
{
    private const string ConfigurationDirectoryName = "Jellyfin.Plugin.Featured";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly object _syncRoot = new();
    private readonly ILogger<FeaturedPreferenceStore> _logger;
    private readonly string _filePath;
    private Dictionary<string, FeaturedUserPreferences>? _preferences;

    public FeaturedPreferenceStore(IApplicationPaths applicationPaths, ILogger<FeaturedPreferenceStore> logger)
    {
        _logger = logger;
        _filePath = Path.Combine(applicationPaths.PluginConfigurationsPath, ConfigurationDirectoryName, "user-preferences.json");
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
        if (!File.Exists(_filePath))
        {
            _preferences = new(StringComparer.OrdinalIgnoreCase);
            return;
        }

        try
        {
            Dictionary<string, FeaturedUserPreferences> loaded =
                JsonSerializer.Deserialize<Dictionary<string, FeaturedUserPreferences>>(File.ReadAllText(_filePath), JsonOptions) ?? [];
            _preferences = new Dictionary<string, FeaturedUserPreferences>(loaded, StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read Jellyfin Featured user preferences; starting with empty preferences.");
            _preferences = new(StringComparer.OrdinalIgnoreCase);
        }
    }

    private void Save()
    {
        try
        {
            string directory = Path.GetDirectoryName(_filePath)!;
            Directory.CreateDirectory(directory);
            string temporaryPath = _filePath + ".tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(_preferences, JsonOptions));
            File.Move(temporaryPath, _filePath, true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not persist Jellyfin Featured user preferences.");
        }
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

    internal FeaturedUserDisplayPreferences Copy() => new()
    {
        EnableBackgroundTrailers = EnableBackgroundTrailers,
        ShowRating = ShowRating,
        ShowDescription = ShowDescription,
        ShowYear = ShowYear,
        ShowRuntime = ShowRuntime,
        ShowFavoriteButton = ShowFavoriteButton,
        ShowPlaystateButton = ShowPlaystateButton
    };

    internal bool IsEmpty()
        => !EnableBackgroundTrailers.HasValue
            && !ShowRating.HasValue
            && !ShowDescription.HasValue
            && !ShowYear.HasValue
            && !ShowRuntime.HasValue
            && !ShowFavoriteButton.HasValue
            && !ShowPlaystateButton.HasValue;
}
