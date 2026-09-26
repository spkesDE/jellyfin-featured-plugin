using System.Text.Json.Serialization;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedRuleDiagnostic
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int CandidateItems { get; set; }
    public int FilteredOut { get; set; }
    public int AfterFilters { get; set; }
    public int Ineligible { get; set; }
    public int CooldownExcluded { get; set; }
    public int DismissedExcluded { get; set; }
    public int Eligible { get; set; }
    public int Allocated { get; set; }
    public int Duplicates { get; set; }
    public int DiversitySkipped { get; set; }
    public int CooldownRelaxed { get; set; }
    public int Returned { get; set; }
    [JsonPropertyName("fallback")]
    public bool IsFallback { get; set; }
}

internal sealed record FeaturedSelection(
    List<BaseItem> Items,
    List<FeaturedRuleDiagnostic> RuleStats,
    bool UserProfileApplied,
    FeaturedRuleEngineTiming Timing,
    IReadOnlyDictionary<Guid, FeaturedItemSelectionReason> ItemReasons);

internal sealed record FeaturedItemSelectionReason(
    string RuleId,
    string SourceType,
    bool AllowBackgroundTrailers,
    bool UseTrickplayFallback = false,
    bool UseMediaPreviewFallback = false);

internal sealed record FeaturedRuleEngineTiming(
    double SourceCandidatesMilliseconds,
    double MetadataSnapshotMilliseconds,
    double AllowedItemsAccessMilliseconds,
    double UserDataBatchMilliseconds,
    double GlobalFiltersMilliseconds,
    double RuleFiltersMilliseconds,
    double PersonalizationScoringMilliseconds,
    double PoolAllocationMilliseconds,
    double TotalMilliseconds)
{
    internal string FormatReport() => FormattableString.Invariant($"""
        Rule engine timing
        ------------------------------
        source candidates       {SourceCandidatesMilliseconds,8:0.0} ms
        metadata snapshot       {MetadataSnapshotMilliseconds,8:0.0} ms
        allowed-items access    {AllowedItemsAccessMilliseconds,8:0.0} ms
        user-data batch         {UserDataBatchMilliseconds,8:0.0} ms
        global filters          {GlobalFiltersMilliseconds,8:0.0} ms
        rule filters            {RuleFiltersMilliseconds,8:0.0} ms
        personalization/scoring {PersonalizationScoringMilliseconds,8:0.0} ms
        pool allocation         {PoolAllocationMilliseconds,8:0.0} ms
        ------------------------------
        total                   {TotalMilliseconds,8:0.0} ms
        """);
}

internal sealed class FeaturedRulePool
{
    internal FeaturedRulePool(
        int index,
        FeaturedSourceRule rule,
        IEnumerable<BaseItem> items,
        IEnumerable<BaseItem> cooldownItems,
        FeaturedRuleDiagnostic stats)
    {
        Index = index;
        Rule = rule;
        Items = new Queue<BaseItem>(items);
        CooldownItems = new Queue<BaseItem>(cooldownItems);
        Stats = stats;
    }

    internal int Index { get; }
    internal FeaturedSourceRule Rule { get; }
    internal Queue<BaseItem> Items { get; }
    internal Queue<BaseItem> DeferredItems { get; } = new();
    internal Queue<BaseItem> CooldownItems { get; }
    internal FeaturedRuleDiagnostic Stats { get; }
    internal int Quota { get; set; }
}

internal sealed class FeaturedDiversityTracker
{
    private readonly int _maximumItemsPerGenre;
    private readonly int _maximumItemsPerFranchise;
    private readonly Dictionary<string, int> _genreCounts = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, int> _franchiseCounts = new(StringComparer.OrdinalIgnoreCase);

    internal FeaturedDiversityTracker(PluginConfiguration config)
    {
        _maximumItemsPerGenre = config.MaximumItemsPerGenre;
        _maximumItemsPerFranchise = config.MaximumItemsPerFranchise;
    }

    internal bool CanAdd(BaseItem item)
    {
        string? genre = GetPrimaryGenre(item);
        if (_maximumItemsPerGenre > 0 && genre is not null && GetCount(_genreCounts, genre) >= _maximumItemsPerGenre)
        {
            return false;
        }

        string? franchise = GetFranchise(item);
        if (_maximumItemsPerFranchise > 0
            && franchise is not null
            && GetCount(_franchiseCounts, franchise) >= _maximumItemsPerFranchise)
        {
            return false;
        }

        return true;
    }

    internal void Record(BaseItem item)
    {
        Increment(_genreCounts, GetPrimaryGenre(item));
        Increment(_franchiseCounts, GetFranchise(item));
    }

    private static string? GetPrimaryGenre(BaseItem item)
        => item.Genres.FirstOrDefault(genre => !string.IsNullOrWhiteSpace(genre))?.Trim();

    private static string? GetFranchise(BaseItem item)
        => item is Movie movie && !string.IsNullOrWhiteSpace(movie.TmdbCollectionName)
            ? movie.TmdbCollectionName.Trim()
            : null;

    private static int GetCount(Dictionary<string, int> counts, string key)
        => counts.TryGetValue(key, out int count) ? count : 0;

    private static void Increment(Dictionary<string, int> counts, string? key)
    {
        if (key is null) return;
        counts[key] = GetCount(counts, key) + 1;
    }
}
