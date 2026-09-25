using System.Text.RegularExpressions;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Net;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured;

internal static class DirectScriptInjector
{
    private static readonly Regex ScriptMarkerRegex = new(
        "<script\\b(?=[^>]*\\bplugin=([\"'])Featured\\1)[^>]*>\\s*</script>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BootstrapRegex = new(
        Regex.Escape(FrontendBootstrap.StartMarker) + ".*?" + Regex.Escape(FrontendBootstrap.EndMarker),
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    internal static bool IsAvailable(IApplicationPaths applicationPaths)
    {
        if (string.IsNullOrWhiteSpace(applicationPaths.WebPath))
        {
            return false;
        }

        string indexFile = Path.Combine(applicationPaths.WebPath, "index.html");
        if (!File.Exists(indexFile))
        {
            return false;
        }

        try
        {
            using FileStream stream = File.Open(indexFile, FileMode.Open, FileAccess.ReadWrite, FileShare.ReadWrite);
            return true;
        }
        catch
        {
            return false;
        }
    }

    internal static bool TryInject(IApplicationPaths applicationPaths, ILogger logger)
    {
        string? indexFile = GetIndexFile(applicationPaths, logger);
        if (indexFile is null)
        {
            return false;
        }

        try
        {
            PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
            string contents = File.ReadAllText(indexFile);
            string stripped = Strip(contents);
            int headClosing = stripped.LastIndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            int bodyClosing = stripped.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyClosing < 0)
            {
                logger.LogWarning("Could not find a closing body tag in {IndexFile}.", indexFile);
                return false;
            }

            string bootstrap = FrontendBootstrap.BuildHtml(configuration);
            if (bootstrap.Length > 0 && headClosing >= 0)
            {
                stripped = stripped.Insert(headClosing, bootstrap);
                bodyClosing = stripped.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            }

            string updated = stripped.Insert(bodyClosing, BuildScriptTag());
            if (!string.Equals(contents, updated, StringComparison.Ordinal))
            {
                File.WriteAllText(indexFile, updated);
                logger.LogInformation("Injected the Jellyfin Featured client script directly into {IndexFile}.", indexFile);
            }
            else
            {
                logger.LogInformation("Found the Jellyfin Featured client script in {IndexFile}.", indexFile);
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to inject the Jellyfin Featured client script into {IndexFile}.", indexFile);
            return false;
        }
    }

    internal static void TryRemove(IApplicationPaths applicationPaths, ILogger logger)
    {
        string? indexFile = GetIndexFile(applicationPaths, logger, logMissing: false);
        if (indexFile is null)
        {
            return;
        }

        try
        {
            string contents = File.ReadAllText(indexFile);
            string updated = Strip(contents);
            if (!string.Equals(contents, updated, StringComparison.Ordinal))
            {
                File.WriteAllText(indexFile, updated);
                logger.LogInformation("Removed the direct Jellyfin Featured injection from {IndexFile}.", indexFile);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not remove the previous direct Jellyfin Featured injection from {IndexFile}.", indexFile);
        }
    }

    private static string Strip(string contents)
        => BootstrapRegex.Replace(ScriptMarkerRegex.Replace(contents, string.Empty), string.Empty);

    private static string? GetIndexFile(
        IApplicationPaths applicationPaths,
        ILogger logger,
        bool logMissing = true)
    {
        if (string.IsNullOrWhiteSpace(applicationPaths.WebPath))
        {
            if (logMissing)
            {
                logger.LogWarning("Jellyfin's web path is unavailable; direct frontend injection cannot be used.");
            }

            return null;
        }

        string indexFile = Path.Combine(applicationPaths.WebPath, "index.html");
        if (!File.Exists(indexFile))
        {
            if (logMissing)
            {
                logger.LogWarning("Jellyfin's web index was not found at {IndexFile}.", indexFile);
            }

            return null;
        }

        return indexFile;
    }

    private static string BuildScriptTag()
    {
        string basePath = string.Empty;
        NetworkConfiguration? network = Plugin.Instance?.ServerConfigurationManager.GetNetworkConfiguration();
        if (!string.IsNullOrWhiteSpace(network?.BaseUrl))
        {
            basePath = "/" + network.BaseUrl.Trim().Trim('/');
        }

        return $"<script DirectInjection=\"true\" data-injection-method=\"direct\" plugin=\"Featured\" defer=\"defer\" src=\"{basePath}/featured/script\"></script>";
    }
}
