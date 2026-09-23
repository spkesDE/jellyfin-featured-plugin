using System.Text.Json;
using Jellyfin.Data.Enums;
using Jellyfin.Extensions;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public static class FeaturedDismissalScopes
{
    public const string Title = "title";
    public const string Series = "series";
    public const string Franchise = "franchise";
}

public sealed class FeaturedDismissalEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Scope { get; set; } = FeaturedDismissalScopes.Title;
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public DateTimeOffset DismissedAt { get; set; } = DateTimeOffset.UtcNow;

    internal FeaturedDismissalEntry Copy() => new()
    {
        Id = Id,
        Scope = Scope,
        Key = Key,
        Name = Name,
        ItemId = ItemId,
        DismissedAt = DismissedAt
    };
}

internal sealed class FeaturedDismissalSnapshot
{
    internal static readonly FeaturedDismissalSnapshot Empty = new([]);
    private readonly HashSet<Guid> _titleIds;
    private readonly HashSet<Guid> _seriesIds;
    private readonly HashSet<string> _franchises;

    internal FeaturedDismissalSnapshot(IEnumerable<FeaturedDismissalEntry> entries)
    {
        FeaturedDismissalEntry[] values = entries.ToArray();
        _titleIds = ParseIds(values, FeaturedDismissalScopes.Title);
        _seriesIds = ParseIds(values, FeaturedDismissalScopes.Series);
        _franchises = values
            .Where(entry => entry.Scope == FeaturedDismissalScopes.Franchise && !string.IsNullOrWhiteSpace(entry.Key))
            .Select(entry => entry.Key.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        Fingerprint = string.Join('|', values
            .Select(entry => $"{entry.Scope}:{entry.Key}")
            .Order(StringComparer.OrdinalIgnoreCase));
    }

    internal string Fingerprint { get; }

    internal bool IsDismissed(BaseItem item)
    {
        if (_titleIds.Contains(item.Id)) return true;
        if (item.GetBaseItemKind() == BaseItemKind.Series && _seriesIds.Contains(item.Id)) return true;
        return item is Movie movie
            && !string.IsNullOrWhiteSpace(movie.TmdbCollectionName)
            && _franchises.Contains(movie.TmdbCollectionName.Trim());
    }

    private static HashSet<Guid> ParseIds(IEnumerable<FeaturedDismissalEntry> entries, string scope)
        => entries
            .Where(entry => entry.Scope == scope)
            .Select(entry => Guid.TryParse(entry.Key, out Guid id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToHashSet();
}

public sealed class FeaturedDismissalStore
{
    private const int MaximumEntriesPerUser = 1000;
    private const string ConfigurationDirectoryName = "Jellyfin.Plugin.Featured";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly object _syncRoot = new();
    private readonly ILogger<FeaturedDismissalStore> _logger;
    private readonly string _filePath;
    private Dictionary<string, List<FeaturedDismissalEntry>>? _entries;

    public FeaturedDismissalStore(IApplicationPaths applicationPaths, ILogger<FeaturedDismissalStore> logger)
    {
        _logger = logger;
        _filePath = Path.Combine(
            applicationPaths.PluginConfigurationsPath,
            ConfigurationDirectoryName,
            "dismissals.json");
    }

    internal IReadOnlyList<FeaturedDismissalEntry> Get(Guid userId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            return _entries!.TryGetValue(userId.ToString("N"), out List<FeaturedDismissalEntry>? entries)
                ? entries.Select(entry => entry.Copy()).OrderByDescending(entry => entry.DismissedAt).ToArray()
                : [];
        }
    }

    internal FeaturedDismissalSnapshot GetSnapshot(Guid userId) => new(Get(userId));

    internal FeaturedDismissalEntry Add(Guid userId, FeaturedDismissalEntry entry)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            string userKey = userId.ToString("N");
            if (!_entries!.TryGetValue(userKey, out List<FeaturedDismissalEntry>? entries))
            {
                entries = [];
                _entries[userKey] = entries;
            }

            FeaturedDismissalEntry? existing = entries.FirstOrDefault(candidate =>
                string.Equals(candidate.Scope, entry.Scope, StringComparison.OrdinalIgnoreCase)
                && string.Equals(candidate.Key, entry.Key, StringComparison.OrdinalIgnoreCase));
            if (existing is not null)
            {
                existing.Name = entry.Name;
                existing.ItemId = entry.ItemId;
                existing.DismissedAt = DateTimeOffset.UtcNow;
                Save();
                return existing.Copy();
            }

            entries.Insert(0, entry.Copy());
            if (entries.Count > MaximumEntriesPerUser)
            {
                entries.RemoveRange(MaximumEntriesPerUser, entries.Count - MaximumEntriesPerUser);
            }

            Save();
            return entry.Copy();
        }
    }

    internal bool Remove(Guid userId, string dismissalId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            if (!_entries!.TryGetValue(userId.ToString("N"), out List<FeaturedDismissalEntry>? entries)) return false;
            int removed = entries.RemoveAll(entry => string.Equals(entry.Id, dismissalId, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) return false;
            if (entries.Count == 0) _entries.Remove(userId.ToString("N"));
            Save();
            return true;
        }
    }

    internal int Clear(Guid userId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            string key = userId.ToString("N");
            if (!_entries!.TryGetValue(key, out List<FeaturedDismissalEntry>? entries)) return 0;
            int count = entries.Count;
            _entries.Remove(key);
            Save();
            return count;
        }
    }

    private void EnsureLoaded()
    {
        if (_entries is not null) return;
        if (!File.Exists(_filePath))
        {
            _entries = new(StringComparer.OrdinalIgnoreCase);
            return;
        }

        try
        {
            Dictionary<string, List<FeaturedDismissalEntry>> loaded =
                JsonSerializer.Deserialize<Dictionary<string, List<FeaturedDismissalEntry>>>(File.ReadAllText(_filePath), JsonOptions)
                ?? [];
            _entries = new Dictionary<string, List<FeaturedDismissalEntry>>(loaded, StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read Jellyfin Featured dismissals; starting with an empty store.");
            _entries = new(StringComparer.OrdinalIgnoreCase);
        }
    }

    private void Save()
    {
        try
        {
            string directory = Path.GetDirectoryName(_filePath)!;
            Directory.CreateDirectory(directory);
            string temporaryPath = _filePath + ".tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(_entries, JsonOptions));
            File.Move(temporaryPath, _filePath, true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not persist Jellyfin Featured dismissals.");
        }
    }
}
