namespace Jellyfin.Plugin.Featured;

internal static class PluginConfigurationNormalizer
{
    private static readonly HashSet<string> ValidSourceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        FeaturedSourceTypes.Libraries,
        FeaturedSourceTypes.Collections,
        FeaturedSourceTypes.Favourites,
        FeaturedSourceTypes.Tags,
        FeaturedSourceTypes.Playlists,
        FeaturedSourceTypes.RecentlyAdded,
        FeaturedSourceTypes.LatestReleases,
        FeaturedSourceTypes.Random,
        FeaturedSourceTypes.Unplayed,
        FeaturedSourceTypes.ManualLists
    };

    private static readonly HashSet<string> ValidFilterFields = new(StringComparer.OrdinalIgnoreCase)
    {
        FeaturedFilterFields.Library,
        FeaturedFilterFields.Genre,
        FeaturedFilterFields.Tag,
        FeaturedFilterFields.MediaType,
        FeaturedFilterFields.Played,
        FeaturedFilterFields.CommunityRating,
        FeaturedFilterFields.CriticRating,
        FeaturedFilterFields.ProductionYear,
        FeaturedFilterFields.RuntimeMinutes
    };

    private static readonly HashSet<string> ValidFilterOperators = new(StringComparer.OrdinalIgnoreCase)
    {
        FeaturedFilterOperators.Equal,
        FeaturedFilterOperators.NotEquals,
        FeaturedFilterOperators.GreaterThanOrEqual,
        FeaturedFilterOperators.LessThanOrEqual,
        FeaturedFilterOperators.ContainsAny,
        FeaturedFilterOperators.ContainsAll
    };

    internal static PluginConfiguration Normalize(PluginConfiguration? source)
    {
        PluginConfiguration config = source ?? new PluginConfiguration();

        config.FrontendInjectionMethod = config.FrontendInjectionMethod switch
        {
            FrontendInjectionMethods.FileTransformation => FrontendInjectionMethods.FileTransformation,
            FrontendInjectionMethods.JavaScriptInjector => FrontendInjectionMethods.JavaScriptInjector,
            _ => FrontendInjectionMethods.Automatic
        };

        config.SourceRules ??= [];
        config.SourceRules = config.SourceRules
            .Where(rule => rule is not null && ValidSourceTypes.Contains(rule.Type))
            .Select(NormalizeSourceRule)
            .Take(50)
            .ToArray();
        config.GlobalFilters = NormalizeFilters(config.GlobalFilters);
        config.ManualLists = NormalizeManualLists(config.ManualLists);
        config.UserProfiles = NormalizeUserProfiles(config.UserProfiles);
        config.PersonalizationDefaults ??= new FeaturedPersonalizationDefaults();
        config.PersonalizationDefaults.UnplayedBoost = Math.Clamp(config.PersonalizationDefaults.UnplayedBoost, 0, 100);
        config.PersonalizationDefaults.FavouriteBoost = Math.Clamp(config.PersonalizationDefaults.FavouriteBoost, 0, 100);
        config.PersonalizationDefaults.PreferredGenreBoost = Math.Clamp(config.PersonalizationDefaults.PreferredGenreBoost, 0, 100);
        config.PersonalizationDefaults.InProgressSeriesBoost = Math.Clamp(config.PersonalizationDefaults.InProgressSeriesBoost, 0, 100);
        config.PersonalizationDefaults.PreferredGenres = NormalizeValues(config.PersonalizationDefaults.PreferredGenres);
        config.PersonalizationPolicy ??= new FeaturedPersonalizationPolicy();
        config.Presets = NormalizePresets(config.Presets);
        config.RepeatCooldownDays = Math.Clamp(config.RepeatCooldownDays, 0, 3650);
        config.MaximumItemsPerGenre = Math.Clamp(config.MaximumItemsPerGenre, 0, 100);
        config.MaximumItemsPerFranchise = Math.Clamp(config.MaximumItemsPerFranchise, 0, 100);
        config.RandomMediaCount = Math.Clamp(config.RandomMediaCount, 1, 100);
        config.AutoplayInterval = Math.Clamp(config.AutoplayInterval, 1, 3600);
        config.TrailerSourcePriority = config.TrailerSourcePriority switch
        {
            FeaturedTrailerSourcePriorities.PreferRemote => FeaturedTrailerSourcePriorities.PreferRemote,
            FeaturedTrailerSourcePriorities.LocalOnly => FeaturedTrailerSourcePriorities.LocalOnly,
            FeaturedTrailerSourcePriorities.RemoteOnly => FeaturedTrailerSourcePriorities.RemoteOnly,
            FeaturedTrailerSourcePriorities.Automatic => FeaturedTrailerSourcePriorities.Automatic,
            _ => FeaturedTrailerSourcePriorities.PreferLocal
        };
        config.TrailerDelayMilliseconds = Math.Clamp(config.TrailerDelayMilliseconds, 0, 30000);
        config.TrailerStartOffsetSeconds = Math.Clamp(config.TrailerStartOffsetSeconds, 0, 3600);
        config.TrailerEndOffsetSeconds = Math.Clamp(config.TrailerEndOffsetSeconds, 0, 3600);
        config.MultipleTrailerMode = config.MultipleTrailerMode == FeaturedMultipleTrailerModes.Random
            ? FeaturedMultipleTrailerModes.Random
            : FeaturedMultipleTrailerModes.First;
        config.TrailerOverrides = NormalizeTrailerOverrides(config.TrailerOverrides);
        config.BannerHeight = Math.Clamp(config.BannerHeight, 240, 900);
        config.TabletBannerHeight = Math.Clamp(config.TabletBannerHeight, 240, 700);
        config.MobileBannerHeight = Math.Clamp(config.MobileBannerHeight, 220, 600);
        config.HeroBorderRadius = Math.Clamp(config.HeroBorderRadius, 0, 48);
        config.HeroGradientStrength = Math.Clamp(config.HeroGradientStrength, 0, 100);
        config.HeroHeightMode = config.HeroHeightMode is "auto" or "compact" or "cinematic" or "custom" ? config.HeroHeightMode : "standard";
        config.HeroTextPosition = config.HeroTextPosition is "center" or "right" ? config.HeroTextPosition : "left";
        config.MediaPadding = Math.Clamp(config.MediaPadding, -240, 240);
        config.TransitionEffect = config.TransitionEffect is "fade" ? "fade" : "slide";
        config.HeroBackdropPosition = config.HeroBackdropPosition is "top" or "bottom" ? config.HeroBackdropPosition : "center";
        config.TitleDisplayMode = config.TitleDisplayMode is "title" ? "title" : "logo";
        return config;
    }

    private static FeaturedPreset[] NormalizePresets(FeaturedPreset[]? presets)
    {
        return (presets ?? [])
            .Where(preset => preset is not null)
            .Select(preset =>
            {
                preset.Id = NormalizeId(preset.Id);
                preset.Name = string.IsNullOrWhiteSpace(preset.Name) ? "Featured preset" : preset.Name.Trim();
                preset.Priority = Math.Clamp(preset.Priority, -1000, 1000);
                (preset.StartsAt, preset.EndsAt) = NormalizeSchedule(preset.StartsAt, preset.EndsAt);
                preset.SourceRules = (preset.SourceRules ?? [])
                    .Where(rule => rule is not null && ValidSourceTypes.Contains(rule.Type))
                    .Select(NormalizeSourceRule)
                    .Take(50)
                    .ToArray();
                preset.GlobalFilters = NormalizeFilters(preset.GlobalFilters);
                preset.PersonalizationPolicy ??= new FeaturedPersonalizationPolicy();
                preset.Mixer ??= new FeaturedPresetMixerSettings();
                preset.Mixer.RepeatCooldownDays = Math.Clamp(preset.Mixer.RepeatCooldownDays, 0, 3650);
                preset.Mixer.MaximumItemsPerGenre = Math.Clamp(preset.Mixer.MaximumItemsPerGenre, 0, 100);
                preset.Mixer.MaximumItemsPerFranchise = Math.Clamp(preset.Mixer.MaximumItemsPerFranchise, 0, 100);
                preset.Mixer.RandomMediaCount = Math.Clamp(preset.Mixer.RandomMediaCount, 1, 100);
                preset.Layout ??= new FeaturedPresetLayoutSettings();
                NormalizePresetLayout(preset.Layout);
                preset.Trailers ??= new FeaturedPresetTrailerSettings();
                NormalizePresetTrailers(preset.Trailers);
                return preset;
            })
            .DistinctBy(preset => preset.Id, StringComparer.OrdinalIgnoreCase)
            .Take(50)
            .ToArray();
    }

    private static void NormalizePresetLayout(FeaturedPresetLayoutSettings layout)
    {
        layout.AutoplayInterval = Math.Clamp(layout.AutoplayInterval, 1, 3600);
        layout.BannerHeight = Math.Clamp(layout.BannerHeight, 240, 900);
        layout.TabletBannerHeight = Math.Clamp(layout.TabletBannerHeight, 240, 700);
        layout.MobileBannerHeight = Math.Clamp(layout.MobileBannerHeight, 220, 600);
        layout.HeroBorderRadius = Math.Clamp(layout.HeroBorderRadius, 0, 48);
        layout.HeroGradientStrength = Math.Clamp(layout.HeroGradientStrength, 0, 100);
        layout.HeroHeightMode = layout.HeroHeightMode is "auto" or "compact" or "cinematic" or "custom" ? layout.HeroHeightMode : "standard";
        layout.HeroTextPosition = layout.HeroTextPosition is "center" or "right" ? layout.HeroTextPosition : "left";
        layout.MediaPadding = Math.Clamp(layout.MediaPadding, -240, 240);
        layout.TransitionEffect = layout.TransitionEffect is "fade" ? "fade" : "slide";
        layout.HeroBackdropPosition = layout.HeroBackdropPosition is "top" or "bottom" ? layout.HeroBackdropPosition : "center";
        layout.TitleDisplayMode = layout.TitleDisplayMode is "title" ? "title" : "logo";
        layout.SecondaryButtonText = NullIfWhiteSpace(layout.SecondaryButtonText);
        layout.Heading = NullIfWhiteSpace(layout.Heading);
        layout.PlayButtonText = NullIfWhiteSpace(layout.PlayButtonText);
    }

    private static void NormalizePresetTrailers(FeaturedPresetTrailerSettings trailers)
    {
        trailers.TrailerSourcePriority = trailers.TrailerSourcePriority switch
        {
            FeaturedTrailerSourcePriorities.PreferRemote => FeaturedTrailerSourcePriorities.PreferRemote,
            FeaturedTrailerSourcePriorities.LocalOnly => FeaturedTrailerSourcePriorities.LocalOnly,
            FeaturedTrailerSourcePriorities.RemoteOnly => FeaturedTrailerSourcePriorities.RemoteOnly,
            FeaturedTrailerSourcePriorities.Automatic => FeaturedTrailerSourcePriorities.Automatic,
            _ => FeaturedTrailerSourcePriorities.PreferLocal
        };
        trailers.TrailerDelayMilliseconds = Math.Clamp(trailers.TrailerDelayMilliseconds, 0, 30000);
        trailers.TrailerStartOffsetSeconds = Math.Clamp(trailers.TrailerStartOffsetSeconds, 0, 3600);
        trailers.TrailerEndOffsetSeconds = Math.Clamp(trailers.TrailerEndOffsetSeconds, 0, 3600);
        trailers.MultipleTrailerMode = trailers.MultipleTrailerMode == FeaturedMultipleTrailerModes.Random
            ? FeaturedMultipleTrailerModes.Random
            : FeaturedMultipleTrailerModes.First;
    }

    private static FeaturedSourceRule NormalizeSourceRule(FeaturedSourceRule rule)
    {
        rule.Id = string.IsNullOrWhiteSpace(rule.Id) ? Guid.NewGuid().ToString("N") : rule.Id.Trim();
        rule.Type = rule.Type.ToUpperInvariant();
        rule.Weight = Math.Clamp(rule.Weight, 1, 100);
        rule.MinimumItems = Math.Clamp(rule.MinimumItems, 0, 100);
        rule.MaximumItems = Math.Clamp(rule.MaximumItems, 0, 100);
        if (rule.MaximumItems > 0 && rule.MinimumItems > rule.MaximumItems)
        {
            rule.MinimumItems = rule.MaximumItems;
        }
        rule.EditorUserId = string.IsNullOrWhiteSpace(rule.EditorUserId) ? null : rule.EditorUserId.Trim();
        rule.LibraryIds = NormalizeValues(rule.LibraryIds);
        rule.CollectionIds = NormalizeValues(rule.CollectionIds);
        rule.PlaylistIds = NormalizeValues(rule.PlaylistIds);
        rule.ManualListIds = NormalizeValues(rule.ManualListIds);
        rule.Tags = NormalizeValues(rule.Tags);
        rule.RecentDays = Math.Clamp(rule.RecentDays, 1, 3650);
        rule.Filters = NormalizeFilters(rule.Filters);
        return rule;
    }

    private static FeaturedFilterRule[] NormalizeFilters(FeaturedFilterRule[]? filters)
    {
        return (filters ?? [])
            .Where(filter => filter is not null
                && ValidFilterFields.Contains(filter.Field)
                && ValidFilterOperators.Contains(filter.Operator))
            .Select(filter =>
            {
                filter.Id = string.IsNullOrWhiteSpace(filter.Id) ? Guid.NewGuid().ToString("N") : filter.Id.Trim();
                filter.Field = filter.Field.ToUpperInvariant();
                filter.Operator = NormalizeOperator(filter.Field, filter.Operator.ToUpperInvariant());
                filter.Values = NormalizeValues(filter.Values);
                return filter;
            })
            .Take(50)
            .ToArray();
    }

    private static FeaturedManualList[] NormalizeManualLists(FeaturedManualList[]? lists)
    {
        return (lists ?? [])
            .Where(list => list is not null)
            .Select(list =>
            {
                list.Id = NormalizeId(list.Id);
                list.Name = string.IsNullOrWhiteSpace(list.Name) ? "Featured list" : list.Name.Trim();
                (list.StartsAt, list.EndsAt) = NormalizeSchedule(list.StartsAt, list.EndsAt);
                list.Items = (list.Items ?? [])
                    .Where(item => item is not null && Guid.TryParse(item.ItemId, out _))
                    .Select((item, index) =>
                    {
                        item.Id = NormalizeId(item.Id);
                        item.ItemId = item.ItemId.Trim();
                        item.Name = item.Name?.Trim() ?? string.Empty;
                        item.MediaType = item.MediaType?.Trim() ?? string.Empty;
                        item.ImageType = item.ImageType == "Primary" ? "Primary" : "Backdrop";
                        item.Position = index;
                        (item.StartsAt, item.EndsAt) = NormalizeSchedule(item.StartsAt, item.EndsAt);
                        return item;
                    })
                    .DistinctBy(item => item.ItemId, StringComparer.OrdinalIgnoreCase)
                    .Take(200)
                    .ToArray();
                return list;
            })
            .Take(20)
            .ToArray();
    }

    private static FeaturedUserProfile[] NormalizeUserProfiles(FeaturedUserProfile[]? profiles)
    {
        return (profiles ?? [])
            .Where(profile => profile is not null && Guid.TryParse(profile.UserId, out _))
            .Select(profile =>
            {
                profile.Id = NormalizeId(profile.Id);
                profile.UserId = profile.UserId.Trim();
                profile.UnplayedBoost = Math.Clamp(profile.UnplayedBoost, 0, 100);
                profile.FavouriteBoost = Math.Clamp(profile.FavouriteBoost, 0, 100);
                profile.PreferredGenreBoost = Math.Clamp(profile.PreferredGenreBoost, 0, 100);
                profile.InProgressSeriesBoost = Math.Clamp(profile.InProgressSeriesBoost, 0, 100);
                profile.PreferredGenres = NormalizeValues(profile.PreferredGenres);
                return profile;
            })
            .DistinctBy(profile => profile.UserId, StringComparer.OrdinalIgnoreCase)
            .Take(100)
            .ToArray();
    }

    private static FeaturedTrailerOverride[] NormalizeTrailerOverrides(FeaturedTrailerOverride[]? overrides)
    {
        return (overrides ?? [])
            .Where(entry => entry is not null && Guid.TryParse(entry.ItemId, out _))
            .Select(entry =>
            {
                entry.ItemId = entry.ItemId.Trim();
                entry.Name = entry.Name?.Trim() ?? string.Empty;
                entry.Url = NormalizeTrailerUrl(entry.Url);
                entry.LocalTrailerItemId = Guid.TryParse(entry.LocalTrailerItemId, out Guid localId)
                    ? localId.ToString()
                    : null;
                return entry;
            })
            .Where(entry => entry.Url is not null || entry.LocalTrailerItemId is not null)
            .DistinctBy(entry => entry.ItemId, StringComparer.OrdinalIgnoreCase)
            .Take(200)
            .ToArray();
    }

    private static string? NormalizeTrailerUrl(string? value)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out Uri? uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return null;
        }

        return uri.ToString();
    }

    private static string NormalizeId(string? value)
        => string.IsNullOrWhiteSpace(value) ? Guid.NewGuid().ToString("N") : value.Trim();

    private static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static (DateTimeOffset? StartsAt, DateTimeOffset? EndsAt) NormalizeSchedule(
        DateTimeOffset? startsAt,
        DateTimeOffset? endsAt)
    {
        if (startsAt.HasValue) startsAt = startsAt.Value.ToUniversalTime();
        if (endsAt.HasValue) endsAt = endsAt.Value.ToUniversalTime();
        if (startsAt.HasValue && endsAt.HasValue && endsAt <= startsAt) endsAt = null;
        return (startsAt, endsAt);
    }

    private static string NormalizeOperator(string field, string filterOperator)
    {
        if (field is FeaturedFilterFields.CommunityRating
            or FeaturedFilterFields.CriticRating
            or FeaturedFilterFields.ProductionYear
            or FeaturedFilterFields.RuntimeMinutes)
        {
            return filterOperator == FeaturedFilterOperators.LessThanOrEqual
                ? FeaturedFilterOperators.LessThanOrEqual
                : FeaturedFilterOperators.GreaterThanOrEqual;
        }

        if (field is FeaturedFilterFields.Genre or FeaturedFilterFields.Tag)
        {
            return filterOperator is FeaturedFilterOperators.ContainsAll or FeaturedFilterOperators.NotEquals
                ? filterOperator
                : FeaturedFilterOperators.ContainsAny;
        }

        return filterOperator == FeaturedFilterOperators.NotEquals
            ? FeaturedFilterOperators.NotEquals
            : FeaturedFilterOperators.Equal;
    }

    private static string[] NormalizeValues(string[]? values)
    {
        return (values ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(100)
            .ToArray();
    }
}
