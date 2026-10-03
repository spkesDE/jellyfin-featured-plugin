namespace Jellyfin.Plugin.Featured;

public sealed partial class PluginConfiguration
{
    public bool EnableAutoplay { get; set; } = true;
    public bool ShowAutoplayButton { get; set; } = true;
    public int AutoplayInterval { get; set; } = 10;
    public bool ShowPlayButton { get; set; } = true;
    public bool ShowFavoriteButton { get; set; } = true;
    public string FavoriteButtonPlacement { get; set; } = "metadata";
    public bool ShowPlaystateButton { get; set; } = true;
    public string PlaystateButtonPlacement { get; set; } = "metadata";
    public bool ShowDismissalButton { get; set; } = true;
    public string DismissalButtonPlacement { get; set; } = "metadata";
    public bool ShowNavigationArrows { get; set; } = true;
    public string BannerNavigationPosition { get; set; } = "bottom-center";
    public string BannerMediaControlsPosition { get; set; } = "top-right";
    public bool ShowControlsOnHoverOnly { get; set; }
    public bool InteractOnWholeBanner { get; set; } = true;
    public bool ShowSlidePosition { get; set; } = true;
    public int MediaPadding { get; set; }
    public string TitleDisplayMode { get; set; } = "logo";
    public bool ShowRating { get; set; } = true;
    public bool ShowDescription { get; set; } = true;
    public bool HideOnTvLayout { get; set; }
    public bool UseHeroLayout { get; set; } = true;
    public string HeroHeightMode { get; set; } = "standard";
    public int TabletBannerHeight { get; set; } = 400;
    public int MobileBannerHeight { get; set; } = 340;
    public int HeroBorderRadius { get; set; }
    public int HeroGradientStrength { get; set; } = 100;
    public int HeroFadeStart { get; set; } = 50;
    public int HeroFadeEnd { get; set; } = 100;
    public string HeroFadeCurve { get; set; } = "custom";
    public HeroFadePoint[] HeroFadePoints { get; set; } =
    [
        new() { Position = 0, Fade = 0 },
        new() { Position = 30, Fade = 41 },
        new() { Position = 76, Fade = 67 },
        new() { Position = 100, Fade = 100 }
    ];
    public string HeroTextPosition { get; set; } = "left";
    public string TransitionEffect { get; set; } = "slide";
    public string HeroBackdropPosition { get; set; } = "center";
    public int BannerHeight { get; set; } = 360;
    public bool ShowYear { get; set; } = true;
    public bool ShowRuntime { get; set; } = true;
    public bool ShowSecondaryButton { get; set; } = true;
    public string? SecondaryButtonText { get; set; }
    public bool ShowPaginationDots { get; set; } = true;
    public string? Heading { get; set; }
    public string? PlayButtonText { get; set; }
}
