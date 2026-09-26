using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedItemDtoFactory
{
    private readonly TrailerResolver _trailerResolver;
    private readonly IUserDataManager _userDataManager;

    public FeaturedItemDtoFactory(TrailerResolver trailerResolver, IUserDataManager userDataManager)
    {
        _trailerResolver = trailerResolver;
        _userDataManager = userDataManager;
    }

    internal IReadOnlyList<FeaturedItemProjection> CreateBatch(
        IEnumerable<BaseItem> source,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        IReadOnlyDictionary<Guid, FeaturedItemSelectionReason> reasons)
    {
        List<BaseItem> items = source.ToList();
        IReadOnlyDictionary<Guid, UserItemData> userData = _userDataManager.GetUserDataBatch(items, activeUser);
        return items.Select(item =>
        {
            userData.TryGetValue(item.Id, out UserItemData? data);
            reasons.TryGetValue(item.Id, out FeaturedItemSelectionReason? reason);
            return new FeaturedItemProjection(
                item.Id,
                new Lazy<FeaturedItemDto>(
                    () => Create(
                        item,
                        activeUser,
                        config,
                        personalization,
                        reason?.AllowBackgroundTrailers ?? true,
                        reason?.UseTrickplayFallback == true,
                        reason?.UseMediaPreviewFallback == true,
                        data?.IsFavorite == true,
                        data?.Played == true),
                    LazyThreadSafetyMode.ExecutionAndPublication));
        }).ToArray();
    }

    internal FeaturedItemDto Create(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        bool allowBackgroundTrailers = true,
        bool useTrickplayFallback = false,
        bool useMediaPreviewFallback = false,
        bool isFavorite = false,
        bool isPlayed = false)
    {
        bool hasImage = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop)
            || item.HasImage(MediaBrowser.Model.Entities.ImageType.Primary);
        IReadOnlyList<FeaturedTrailerDto> trailers = personalization.Display.EnableBackgroundTrailers && allowBackgroundTrailers
            ? _trailerResolver.ResolveCandidates(item, activeUser, config)
            : [];
        if (item is Video && trailers.Count == 0
            && (!hasImage || (personalization.Display.EnableBackgroundTrailers && allowBackgroundTrailers)))
        {
            List<FeaturedTrailerDto> fallbackCandidates = [];
            if (useMediaPreviewFallback)
            {
                fallbackCandidates.Add(new FeaturedTrailerDto
                {
                    Type = "local",
                    Provider = "media-preview",
                    Name = item.Name,
                    ItemId = item.Id.ToString()
                });
            }

            if (useTrickplayFallback)
            {
                fallbackCandidates.Add(new FeaturedTrailerDto
                {
                    Type = "trickplay",
                    Provider = "trickplay",
                    Name = item.Name,
                    ItemId = item.Id.ToString()
                });
            }

            trailers = fallbackCandidates;
        }
        List<FeaturedDismissalOptionDto> dismissalOptions = [];
        if (config.DismissalPolicy.Enabled)
        {
            if (config.DismissalPolicy.AllowTitle)
            {
                dismissalOptions.Add(new FeaturedDismissalOptionDto { Scope = FeaturedDismissalScopes.Title, Name = item.Name });
            }

            if (config.DismissalPolicy.AllowSeries && item.GetBaseItemKind() == Jellyfin.Data.Enums.BaseItemKind.Series)
            {
                dismissalOptions.Add(new FeaturedDismissalOptionDto { Scope = FeaturedDismissalScopes.Series, Name = item.Name });
            }

            if (config.DismissalPolicy.AllowFranchise && item is Movie movie && !string.IsNullOrWhiteSpace(movie.TmdbCollectionName))
            {
                dismissalOptions.Add(new FeaturedDismissalOptionDto
                {
                    Scope = FeaturedDismissalScopes.Franchise,
                    Name = movie.TmdbCollectionName.Trim()
                });
            }
        }

        return new FeaturedItemDto
        {
            Id = item.Id.ToString(),
            Name = item.Name,
            MediaType = item.GetBaseItemKind().ToString(),
            ImageType = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop) ? "Backdrop" : "Primary",
            HasImage = hasImage,
            Tagline = personalization.Display.ShowDescription ? item.Tagline : null,
            OfficialRating = personalization.Display.ShowRating ? item.OfficialRating : null,
            HasLogo = item.HasImage(MediaBrowser.Model.Entities.ImageType.Logo),
            IsFavorite = isFavorite,
            IsPlayed = isPlayed,
            DismissalOptions = dismissalOptions.Count > 0 ? dismissalOptions : null,
            ProductionYear = personalization.Display.ShowYear ? item.ProductionYear : null,
            RuntimeMinutes = personalization.Display.ShowRuntime && item.RunTimeTicks.HasValue
                ? (int)Math.Round(TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes)
                : null,
            Trailer = trailers.FirstOrDefault(),
            Trailers = trailers.Count > 0 ? trailers : null,
            Overview = personalization.Display.ShowDescription ? item.Overview : null,
            CriticRating = personalization.Display.ShowRating ? item.CriticRating : null,
            CommunityRating = personalization.Display.ShowRating && item.CommunityRating.HasValue
                ? Math.Round(Convert.ToDecimal(item.CommunityRating), 2)
                : null
        };
    }
}

internal sealed record FeaturedItemProjection(Guid Id, Lazy<FeaturedItemDto> Dto);
