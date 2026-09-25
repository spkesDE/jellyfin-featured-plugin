using System.Reflection;
using System.Runtime.Loader;
using MediaBrowser.Common.Net;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Featured;

internal static class JavaScriptInjectorRegistrar
{
    internal const string ScriptId = "08880a95-8467-4538-bab9-da69c7f4793f-jellyfin-featured";
    private const string AssemblyName = "Jellyfin.Plugin.JavaScriptInjector";
    private const string InterfaceTypeName = "Jellyfin.Plugin.JavaScriptInjector.PluginInterface";

    internal static bool IsAvailable() => FindRegisterMethod() is not null;

    internal static bool TryRegister(ILogger logger) => TrySetEnabled(logger, true);

    internal static bool TrySetEnabled(ILogger logger, bool enabled)
    {
        try
        {
            Plugin? plugin = Plugin.Instance;
            if (plugin is null)
            {
                return false;
            }

            MethodInfo? registerMethod = FindRegisterMethod();
            if (registerMethod is null)
            {
                logger.LogDebug("JavaScript Injector is not available for Jellyfin Featured.");
                return false;
            }

            JObject payload = new()
            {
                { "id", ScriptId },
                { "name", "Jellyfin Featured loader" },
                { "script", BuildLoaderScript() },
                { "enabled", enabled },
                { "requiresAuthentication", false },
                { "pluginId", plugin.Id.ToString() },
                { "pluginName", plugin.Name },
                { "pluginVersion", typeof(JavaScriptInjectorRegistrar).Assembly.GetName().Version?.ToString() ?? string.Empty }
            };

            object? result = registerMethod.Invoke(null, new object?[] { payload });
            if (result is not true)
            {
                return false;
            }

            logger.LogInformation("Jellyfin Featured {LoaderState} its JavaScript Injector loader.", enabled ? "enabled" : "disabled");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to register Jellyfin Featured with JavaScript Injector.");
            return false;
        }
    }

    private static MethodInfo? FindRegisterMethod()
    {
        Assembly? assembly = AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(candidate => candidate.FullName?.Contains(AssemblyName, StringComparison.OrdinalIgnoreCase) ?? false);
        return assembly?.GetType(InterfaceTypeName)?.GetMethod("RegisterScript");
    }

    private static string BuildLoaderScript()
    {
        string basePath = string.Empty;
        NetworkConfiguration? network = Plugin.Instance?.ServerConfigurationManager.GetNetworkConfiguration();
        if (!string.IsNullOrWhiteSpace(network?.BaseUrl))
        {
            basePath = "/" + network.BaseUrl.Trim().Trim('/');
        }

        string scriptUrl = JsonConvert.SerializeObject($"{basePath}/featured/script");
        string bootstrapScript = FrontendBootstrap.BuildScript(PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration));
        return bootstrapScript + Environment.NewLine + $$"""
            (() => {
                'use strict';
                if (window.JellyfinFeatured
                    || document.querySelector('script[plugin="Featured"], script[data-plugin="Featured"]')) {
                    return;
                }
                const script = document.createElement('script');
                script.async = false;
                script.dataset.plugin = 'Featured';
                script.dataset.injectionMethod = 'javascript-injector';
                script.src = {{scriptUrl}};
                (document.head || document.documentElement).appendChild(script);
            })();
            """;
    }
}
