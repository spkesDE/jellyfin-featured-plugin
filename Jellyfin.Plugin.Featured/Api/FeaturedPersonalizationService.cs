using System.Text.Json;

namespace Jellyfin.Plugin.Featured.Api;

public sealed record FeaturedPersonalizationContext(
    FeaturedSourceRule[] SourceRules,
    FeaturedUserProfile Profile,
    string[] ExcludedGenres,
    int RepeatCooldownHours,
    bool HasOverrides)
{
    internal string Fingerprint => JsonSerializer.Serialize(new
    {
        SourceRules,
        Profile,
        ExcludedGenres,
        RepeatCooldownHours
    });
}

public sealed class FeaturedPersonalizationService
{
    private readonly FeaturedPreferenceStore _store;

    public FeaturedPersonalizationService(FeaturedPreferenceStore store)
    {
        _store = store;
    }

    internal FeaturedPersonalizationContext Resolve(PluginConfiguration config, Guid userId)
        => Resolve(config, userId, config.PersonalizationPolicy.Enabled ? _store.Get(userId) : null);

    internal FeaturedPersonalizationContext ResolveDefaults(PluginConfiguration config, Guid userId)
        => Resolve(config, userId, null);

    private static FeaturedPersonalizationContext Resolve(
        PluginConfiguration config,
        Guid userId,
        FeaturedUserPreferences? saved)
    {
        FeaturedPersonalizationPolicy policy = config.PersonalizationPolicy;
        FeaturedUserProfile? adminProfile = config.UserProfiles.FirstOrDefault(candidate =>
            candidate.Enabled && Guid.TryParse(candidate.UserId, out Guid id) && id == userId);
        FeaturedPersonalizationDefaults defaults = config.PersonalizationDefaults;
        FeaturedUserProfile effectiveProfile = new()
        {
            UserId = userId.ToString("N"),
            Enabled = true,
            UnplayedBoost = policy.AllowUnplayedBoost && saved?.UnplayedBoost is int unplayed
                ? unplayed : adminProfile?.UnplayedBoost ?? defaults.UnplayedBoost,
            FavouriteBoost = policy.AllowFavouriteBoost && saved?.FavouriteBoost is int favourite
                ? favourite : adminProfile?.FavouriteBoost ?? defaults.FavouriteBoost,
            PreferredGenreBoost = adminProfile?.PreferredGenreBoost ?? defaults.PreferredGenreBoost,
            InProgressSeriesBoost = policy.AllowInProgressSeriesBoost && saved?.InProgressSeriesBoost is int inProgress
                ? inProgress : adminProfile?.InProgressSeriesBoost ?? defaults.InProgressSeriesBoost,
            PreferredGenres = policy.AllowPreferredGenres && saved?.PreferredGenres is not null
                ? saved.PreferredGenres : adminProfile?.PreferredGenres ?? defaults.PreferredGenres
        };
        FeaturedSourceRule[] sources = config.SourceRules.Select(rule => new FeaturedSourceRule
        {
            Id = rule.Id,
            Type = rule.Type,
            Enabled = policy.Enabled && policy.AllowSourceSelection && saved?.SourceEnabled.TryGetValue(rule.Id, out bool enabled) == true
                ? enabled : rule.Enabled,
            Weight = policy.Enabled && policy.AllowSourceWeights && saved?.SourceWeights.TryGetValue(rule.Id, out int weight) == true
                ? weight : rule.Weight,
            MinimumItems = rule.MinimumItems,
            MaximumItems = rule.MaximumItems,
            IsFallback = rule.IsFallback,
            EditorUserId = rule.EditorUserId,
            LibraryIds = rule.LibraryIds,
            CollectionIds = rule.CollectionIds,
            PlaylistIds = rule.PlaylistIds,
            ManualListIds = rule.ManualListIds,
            Tags = rule.Tags,
            RecentDays = rule.RecentDays,
            Filters = rule.Filters
        }).ToArray();
        string[] excludedGenres = policy.AllowPreferredGenres && saved?.ExcludedGenres is not null
            ? saved.ExcludedGenres : [];
        int defaultCooldownHours = config.RepeatCooldownDays * 24;
        int cooldown = policy.Enabled && policy.AllowRepeatCooldown
            ? saved?.RepeatCooldownHours is int hours
                ? Math.Clamp(hours, 0, 3650 * 24)
                : saved?.RepeatCooldownDays is int legacyDays
                    ? Math.Clamp(legacyDays, 0, 3650) * 24
                    : defaultCooldownHours
            : defaultCooldownHours;
        return new FeaturedPersonalizationContext(sources, effectiveProfile, excludedGenres, cooldown, saved is not null);
    }

    internal FeaturedUserPreferences? Get(Guid userId) => _store.Get(userId);
    internal void Remove(Guid userId) => _store.Remove(userId);

    internal FeaturedUserPreferences NormalizeAndSave(
        PluginConfiguration config,
        Guid userId,
        FeaturedUserPreferences submitted,
        IReadOnlySet<string> allowedGenres)
    {
        FeaturedPersonalizationPolicy policy = config.PersonalizationPolicy;
        HashSet<string> sourceIds = config.SourceRules.Select(rule => rule.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        FeaturedUserPreferences normalized = new();
        if (policy.AllowSourceSelection)
        {
            normalized.SourceEnabled = (submitted.SourceEnabled ?? [])
                .Where(pair => sourceIds.Contains(pair.Key))
                .ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);
        }
        if (policy.AllowSourceWeights)
        {
            normalized.SourceWeights = (submitted.SourceWeights ?? [])
                .Where(pair => sourceIds.Contains(pair.Key))
                .ToDictionary(pair => pair.Key, pair => Math.Clamp(pair.Value, 1, 100), StringComparer.OrdinalIgnoreCase);
        }
        if (policy.AllowPreferredGenres && submitted.PreferredGenres is not null)
        {
            normalized.PreferredGenres = submitted.PreferredGenres
                .Where(genre => !string.IsNullOrWhiteSpace(genre) && allowedGenres.Contains(genre.Trim()))
                .Select(genre => genre.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(50)
                .ToArray();
        }
        if (policy.AllowPreferredGenres && submitted.ExcludedGenres is not null)
        {
            HashSet<string> preferredGenres = (normalized.PreferredGenres ?? [])
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            normalized.ExcludedGenres = submitted.ExcludedGenres
                .Where(genre => !string.IsNullOrWhiteSpace(genre) && allowedGenres.Contains(genre.Trim()))
                .Select(genre => genre.Trim())
                .Where(genre => !preferredGenres.Contains(genre))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(50)
                .ToArray();
        }
        if (policy.AllowUnplayedBoost && submitted.UnplayedBoost.HasValue) normalized.UnplayedBoost = Math.Clamp(submitted.UnplayedBoost.Value, 0, 100);
        if (policy.AllowFavouriteBoost && submitted.FavouriteBoost.HasValue) normalized.FavouriteBoost = Math.Clamp(submitted.FavouriteBoost.Value, 0, 100);
        if (policy.AllowInProgressSeriesBoost && submitted.InProgressSeriesBoost.HasValue) normalized.InProgressSeriesBoost = Math.Clamp(submitted.InProgressSeriesBoost.Value, 0, 100);
        if (policy.AllowRepeatCooldown && submitted.RepeatCooldownHours.HasValue)
        {
            normalized.RepeatCooldownHours = Math.Clamp(submitted.RepeatCooldownHours.Value, 0, 3650 * 24);
        }
        else if (policy.AllowRepeatCooldown && submitted.RepeatCooldownDays.HasValue)
        {
            normalized.RepeatCooldownHours = Math.Clamp(submitted.RepeatCooldownDays.Value, 0, 3650) * 24;
        }
        if (IsEmpty(normalized)) _store.Remove(userId);
        else _store.Set(userId, normalized);
        return normalized;
    }

    private static bool IsEmpty(FeaturedUserPreferences preferences)
        => preferences.SourceEnabled.Count == 0
            && preferences.SourceWeights.Count == 0
            && preferences.PreferredGenres is null
            && preferences.ExcludedGenres is null
            && !preferences.UnplayedBoost.HasValue
            && !preferences.FavouriteBoost.HasValue
            && !preferences.InProgressSeriesBoost.HasValue
            && !preferences.RepeatCooldownHours.HasValue
            && !preferences.RepeatCooldownDays.HasValue;
}
