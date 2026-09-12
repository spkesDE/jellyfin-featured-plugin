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
        config.RepeatCooldownDays = Math.Clamp(config.RepeatCooldownDays, 0, 3650);
        config.RandomMediaCount = Math.Clamp(config.RandomMediaCount, 1, 100);
        config.AutoplayInterval = Math.Clamp(config.AutoplayInterval, 1, 3600);
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

    private static FeaturedSourceRule NormalizeSourceRule(FeaturedSourceRule rule)
    {
        rule.Id = string.IsNullOrWhiteSpace(rule.Id) ? Guid.NewGuid().ToString("N") : rule.Id.Trim();
        rule.Type = rule.Type.ToUpperInvariant();
        rule.Weight = Math.Clamp(rule.Weight, 1, 100);
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

    private static string NormalizeId(string? value)
        => string.IsNullOrWhiteSpace(value) ? Guid.NewGuid().ToString("N") : value.Trim();

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
