using System.Reflection;
using System.Runtime.Loader;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Featured;

internal static class FileTransformationRegistrar
{
    internal const string TransformationId = "080dfa78-de5b-4a3b-a991-45a415c68d40";
    private const string InterfaceTypeName = "Jellyfin.Plugin.FileTransformation.PluginInterface";

    internal static bool TryRegister(ILogger logger)
    {
        try
        {
            Assembly? assembly = AssemblyLoadContext.All
                .SelectMany(context => context.Assemblies)
                .FirstOrDefault(candidate => candidate.FullName?.Contains(".FileTransformation", StringComparison.OrdinalIgnoreCase) ?? false);
            MethodInfo? registerMethod = assembly?.GetType(InterfaceTypeName)?.GetMethod("RegisterTransformation");
            if (registerMethod is null)
            {
                logger.LogDebug("File Transformation is not available for Jellyfin Featured.");
                return false;
            }

            JObject payload = new()
            {
                { "id", TransformationId },
                { "fileNamePattern", "index.html" },
                { "callbackAssembly", typeof(FileTransformationRegistrar).Assembly.FullName },
                { "callbackClass", typeof(Transformations).FullName },
                { "callbackMethod", nameof(Transformations.IndexTransformation) }
            };

            registerMethod.Invoke(null, new object?[] { payload });
            logger.LogInformation("Jellyfin Featured registered its File Transformation patch.");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to register Jellyfin Featured with File Transformation.");
            return false;
        }
    }
}
