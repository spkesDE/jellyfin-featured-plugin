using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Featured;

public sealed partial class PluginConfiguration
{
    public bool EnableBackgroundTrailers { get; set; } = false;
    public string TrailerSourcePriority { get; set; } = FeaturedTrailerSourcePriorities.PreferLocal;

    // Read only for migration of configurations saved before trailer source owned the fallback.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? FallBackToRemoteTrailers { get; set; }

    public bool StartTrailersMuted { get; set; } = true;
    public bool ShowTrailerControls { get; set; } = true;
    public string TrailerVolumeSliderDirection { get; set; } = "down";
    public bool HideYouTubeTrailerUntilControlsFade { get; set; } = true;
    public bool WaitForTrailerToFinish { get; set; }
    public int TrailerDelayMilliseconds { get; set; } = 1500;
    public int TrailerStartOffsetSeconds { get; set; }
    public int TrailerEndOffsetSeconds { get; set; }
    public string MultipleTrailerMode { get; set; } = FeaturedMultipleTrailerModes.First;
    public bool AllowTrailersOnMobile { get; set; } = false;
    public FeaturedTrailerOverride[] TrailerOverrides { get; set; } = [];
}
