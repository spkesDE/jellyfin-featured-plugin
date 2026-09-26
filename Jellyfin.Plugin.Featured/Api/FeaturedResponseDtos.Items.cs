using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedItemsResponseDto : FeaturedDisplaySettingsDto
{
    internal FeaturedItemsResponseDto(
        PluginConfiguration config,
        IReadOnlyList<FeaturedItemDto> items,
        int batchSize,
        int requestedCount,
        FeaturedPersonalizationContext personalization,
        string? activePresetId,
        string? activePresetName,
        DateTimeOffset? nextPresetChange)
        : base(config, personalization)
    {
        Items = items;
        InfiniteLoading = config.EnableInfiniteLoading;
        BatchSize = batchSize;
        HasMore = config.EnableInfiniteLoading && items.Count == requestedCount;
        Autoplay = config.EnableAutoplay;
        AutoplayInterval = config.AutoplayInterval * 1000;
        ReduceImageSizes = config.ReduceImageSize;
        TrackDisplayedItems = personalization.RepeatCooldownHours > 0;
        PersonalizationEnabled = config.PersonalizationPolicy.Enabled;
        DismissalsEnabled = config.DismissalPolicy.Enabled;
        ActivePresetId = activePresetId;
        ActivePresetName = activePresetName;
        NextPresetChange = nextPresetChange;
    }

    public IReadOnlyList<FeaturedItemDto> Items { get; }
    public bool InfiniteLoading { get; }
    public int BatchSize { get; }
    public bool HasMore { get; }
    public bool Autoplay { get; }
    public int AutoplayInterval { get; }
    public bool ReduceImageSizes { get; }
    public bool TrackDisplayedItems { get; }
    public bool PersonalizationEnabled { get; }
    public bool DismissalsEnabled { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetId { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActivePresetName { get; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? NextPresetChange { get; }
}

public sealed class FeaturedItemDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string MediaType { get; init; }
    public required string ImageType { get; init; }
    public required bool HasImage { get; init; }
    public required bool HasLogo { get; init; }
    public bool IsFavorite { get; init; }
    public bool IsPlayed { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<FeaturedDismissalOptionDto>? DismissalOptions { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Tagline { get; init; }

    [JsonPropertyName("official_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? OfficialRating { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public FeaturedTrailerDto? Trailer { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<FeaturedTrailerDto>? Trailers { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Overview { get; init; }

    [JsonPropertyName("critic_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public float? CriticRating { get; init; }

    [JsonPropertyName("community_rating")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? CommunityRating { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? ProductionYear { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RuntimeMinutes { get; init; }
}

public sealed class FeaturedDismissalOptionDto
{
    public required string Scope { get; init; }
    public required string Name { get; init; }
}

public sealed class FeaturedFeedPreviewResponse
{
    public string UserId { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string? ActivePresetId { get; init; }
    public string? ActivePresetName { get; init; }
    public DateTimeOffset? NextPresetChange { get; init; }
    public IReadOnlyList<FeaturedFeedPreviewItem> Items { get; init; } = [];
    public IReadOnlyList<FeaturedRuleDiagnostic> Rules { get; init; } = [];
    public int DuplicatesRemoved { get; init; }
    public int CooldownExcluded { get; init; }
    public int DismissedExcluded { get; init; }
    public int DiversitySkipped { get; init; }
    public bool UserProfileApplied { get; init; }
}

public sealed class FeaturedFeedPreviewItem
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
    public int? ProductionYear { get; init; }
    public string SourceId { get; init; } = string.Empty;
    public string SourceType { get; init; } = string.Empty;
}

public sealed class FeaturedTrailerDto
{
    public required string Type { get; init; }
    public required string Provider { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Url { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? VideoId { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ItemId { get; init; }
}
