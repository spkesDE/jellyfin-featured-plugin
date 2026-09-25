using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MediaBrowser.Common.Net;

namespace Jellyfin.Plugin.Featured;

public static class Transformations
{
    private static readonly Regex ScriptMarkerRegex = new(
        "<script[^>]*plugin=\\\"Featured\\\"[^>]*></script>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ClosingBodyRegex = new(
        "(</body>)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ClosingHeadRegex = new(
        "(</head>)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BootstrapRegex = new(
        Regex.Escape(FrontendBootstrap.StartMarker) + ".*?" + Regex.Escape(FrontendBootstrap.EndMarker),
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    public static string IndexTransformation(PatchRequestPayload payload)
    {
        string contents = payload.Contents ?? string.Empty;
        PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
        string stripped = BootstrapRegex.Replace(ScriptMarkerRegex.Replace(contents, string.Empty), string.Empty);
        if (configuration.FrontendInjectionMethod == FrontendInjectionMethods.JavaScriptInjector)
        {
            return stripped;
        }

        string scriptTag = BuildScriptTag();
        string withBootstrap = ClosingHeadRegex.Replace(stripped, FrontendBootstrap.BuildHtml(configuration) + "$1", 1);
        return withBootstrap.Contains(scriptTag, StringComparison.Ordinal)
            ? withBootstrap
            : ClosingBodyRegex.Replace(withBootstrap, scriptTag + "$1");
    }

    private static string BuildScriptTag()
    {
        string basePath = string.Empty;
        NetworkConfiguration? network = Plugin.Instance?.ServerConfigurationManager.GetNetworkConfiguration();
        if (!string.IsNullOrWhiteSpace(network?.BaseUrl))
        {
            basePath = "/" + network.BaseUrl.Trim().Trim('/');
        }

        return $"<script FileTransformation=\"true\" data-injection-method=\"file-transformation\" plugin=\"Featured\" defer=\"defer\" src=\"{basePath}/featured/script\"></script>";
    }
}

public sealed class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
