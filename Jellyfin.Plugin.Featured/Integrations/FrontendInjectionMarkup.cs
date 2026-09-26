using System.Text.RegularExpressions;
using MediaBrowser.Common.Net;

namespace Jellyfin.Plugin.Featured;

internal static class FrontendInjectionMarkup
{
    private static readonly Regex ScriptMarkerRegex = new(
        "<script\\b(?=[^>]*\\bplugin=([\"'])Featured\\1)[^>]*>\\s*</script>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BootstrapRegex = new(
        Regex.Escape(FrontendBootstrap.StartMarker) + ".*?" + Regex.Escape(FrontendBootstrap.EndMarker),
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    internal static string Strip(string contents)
        => BootstrapRegex.Replace(ScriptMarkerRegex.Replace(contents, string.Empty), string.Empty);

    internal static string BuildScriptTag(string providerAttribute, string injectionMethod)
    {
        string basePath = GetBasePath();
        return $"<script {providerAttribute}=\"true\" data-injection-method=\"{injectionMethod}\" plugin=\"Featured\" defer=\"defer\" src=\"{basePath}/featured/script\"></script>";
    }

    private static string GetBasePath()
    {
        NetworkConfiguration? network = Plugin.Instance?.ServerConfigurationManager.GetNetworkConfiguration();
        return string.IsNullOrWhiteSpace(network?.BaseUrl)
            ? string.Empty
            : "/" + network.BaseUrl.Trim().Trim('/');
    }
}
