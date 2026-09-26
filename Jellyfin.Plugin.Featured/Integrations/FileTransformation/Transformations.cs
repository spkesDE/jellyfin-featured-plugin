using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.Featured;

public static class Transformations
{
    private static readonly Regex ClosingBodyRegex = new(
        "(</body>)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ClosingHeadRegex = new(
        "(</head>)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    public static string IndexTransformation(PatchRequestPayload payload)
    {
        string contents = payload.Contents ?? string.Empty;
        PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
        string stripped = FrontendInjectionMarkup.Strip(contents);
        if (configuration.FrontendInjectionMethod == FrontendInjectionMethods.JavaScriptInjector)
        {
            return stripped;
        }

        string scriptTag = FrontendInjectionMarkup.BuildScriptTag("FileTransformation", "file-transformation");
        string withBootstrap = ClosingHeadRegex.Replace(stripped, FrontendBootstrap.BuildHtml(configuration) + "$1", 1);
        return withBootstrap.Contains(scriptTag, StringComparison.Ordinal)
            ? withBootstrap
            : ClosingBodyRegex.Replace(withBootstrap, scriptTag + "$1");
    }

}

public sealed class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
