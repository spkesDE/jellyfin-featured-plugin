using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedItemDtoFactory
{
    private readonly TrailerResolver _trailerResolver;

    public FeaturedItemDtoFactory(TrailerResolver trailerResolver)
    {
        _trailerResolver = trailerResolver;
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
