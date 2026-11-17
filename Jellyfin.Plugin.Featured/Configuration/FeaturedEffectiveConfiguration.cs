using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Jellyfin.Plugin.Featured;

/// <summary>
/// Normalizes the saved configuration and resolves the active preset once, then reuses the result until the
/// configuration is replaced or the next preset boundary passes. Callers must treat the result as read-only.
/// </summary>
internal static class FeaturedEffectiveConfiguration
{
    private static readonly object Sync = new();
    private static readonly ConditionalWeakTable<PluginConfiguration, string> Fingerprints = new();
    private static PluginConfiguration? _source;
    private static FeaturedPresetResolution? _resolution;

    internal static FeaturedPresetResolution Get() => Get(Plugin.Instance?.Configuration, DateTimeOffset.UtcNow);

    internal static FeaturedPresetResolution Get(PluginConfiguration? source, DateTimeOffset now)
    {
        lock (Sync)
        {
            if (_resolution is not null
                && source is not null
                && ReferenceEquals(_source, source)
                && (_resolution.NextScheduleChange is not { } next || now < next))
            {
                return _resolution;
            }

            PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(source);
            _resolution = FeaturedPresetResolver.Resolve(normalized, now);
            _source = source;
            return _resolution;
        }
    }

    internal static void Invalidate()
    {
        lock (Sync)
        {
            _source = null;
            _resolution = null;
        }
    }

    /// <summary>Serializes a resolved configuration once for cache fingerprints.</summary>
    internal static string GetFingerprint(PluginConfiguration config)
        => Fingerprints.GetValue(config, static value => JsonSerializer.Serialize(value));
}
