using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    private const string ScriptResourcePath = "Jellyfin.Plugin.Featured.dist.featured.bundle.js";
    private const string ConfigScriptResourcePath = "Jellyfin.Plugin.Featured.dist.config.bundle.js";
    private static readonly Lazy<byte[]> ClientScript = new(
        () => LoadEmbeddedScript(ScriptResourcePath),
        LazyThreadSafetyMode.ExecutionAndPublication);
    private static readonly Lazy<ScriptAsset> ConfigScript = new(
        () => CreateScriptAsset(LoadEmbeddedScript(ConfigScriptResourcePath)),
        LazyThreadSafetyMode.ExecutionAndPublication);
    private static readonly object RuntimeScriptSync = new();
    private static string? CachedRuntimeConfiguration;
    private static ScriptAsset? CachedRuntimeScript;

    [HttpGet("script")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        try
        {
            string serializedConfig = JsonSerializer.Serialize(
                CreateRuntimeConfiguration(),
                RuntimeConfigJsonOptions);
            return ServeScript(GetOrCreateRuntimeScript(serializedConfig));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not load the embedded Jellyfin Featured client bundle.");
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "The Jellyfin Featured client bundle is invalid.");
        }
    }

    private FeaturedRuntimeConfigurationDto CreateRuntimeConfiguration()
        => new(_config, _presetResolution.ActivePresetId, _presetResolution.ActivePresetName, _presetResolution.NextScheduleChange);

    [HttpGet("config-script")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [Produces("application/javascript")]
    public ActionResult GetConfigScript()
    {
        try
        {
            return ServeScript(ConfigScript.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not load the embedded Jellyfin Featured configuration bundle.");
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "The Jellyfin Featured configuration bundle is invalid.");
        }
    }

    private ActionResult ServeScript(ScriptAsset asset)
    {
        if (_config.Debug)
        {
            Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
            Response.Headers.Pragma = "no-cache";
            Response.Headers.Expires = "0";
            return File(asset.Content, "application/javascript; charset=utf-8");
        }

        Response.Headers.CacheControl = "private, no-cache";
        Response.Headers.ETag = asset.ETag;
        string requestedTags = Request.Headers.IfNoneMatch.ToString();
        if (requestedTags.Split(',').Any(tag => string.Equals(tag.Trim(), asset.ETag, StringComparison.Ordinal)))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(asset.Content, "application/javascript; charset=utf-8");
    }

    private static ScriptAsset GetOrCreateRuntimeScript(string serializedConfig)
    {
        lock (RuntimeScriptSync)
        {
            if (CachedRuntimeScript is not null
                && string.Equals(CachedRuntimeConfiguration, serializedConfig, StringComparison.Ordinal))
            {
                return CachedRuntimeScript;
            }

            byte[] configBytes = Encoding.UTF8.GetBytes(
                "window.JellyfinFeaturedPluginConfig = " + serializedConfig + ";" + Environment.NewLine);
            byte[] scriptBytes = ClientScript.Value;
            byte[] result = new byte[configBytes.Length + scriptBytes.Length];
            Buffer.BlockCopy(configBytes, 0, result, 0, configBytes.Length);
            Buffer.BlockCopy(scriptBytes, 0, result, configBytes.Length, scriptBytes.Length);
            CachedRuntimeConfiguration = serializedConfig;
            CachedRuntimeScript = CreateScriptAsset(result);
            return CachedRuntimeScript;
        }
    }

    private static ScriptAsset CreateScriptAsset(byte[] content)
        => new(content, $"\"{Convert.ToHexString(SHA256.HashData(content))}\"");

    private static byte[] LoadEmbeddedScript(string resourcePath)
    {
        using Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourcePath);
        if (stream is null) throw new InvalidDataException($"Embedded resource '{resourcePath}' was not found.");
        using MemoryStream buffer = new();
        stream.CopyTo(buffer);
        byte[] script = buffer.ToArray();
        if (script.Length == 0) throw new InvalidDataException($"Embedded resource '{resourcePath}' is empty.");
        return script;
    }

    private sealed record ScriptAsset(byte[] Content, string ETag);
}
