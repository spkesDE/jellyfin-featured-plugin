using System.Reflection;
using System.Runtime.Loader;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Featured;

internal static class FileTransformationRegistrar
{
    internal const string TransformationId = "080dfa78-de5b-4a3b-a991-45a415c68d40";
    private const string InterfaceTypeName = "Jellyfin.Plugin.FileTransformation.PluginInterface";

    internal static bool IsAvailable() => FindRegisterMethod() is not null;

    internal static bool TryRegister(ILogger logger)
    {
        try
        {
            MethodInfo? registerMethod = FindRegisterMethod();
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

            object? result = registerMethod.Invoke(null, new object?[] { payload });
            if (result is false)
            {
                logger.LogWarning("File Transformation rejected the Jellyfin Featured registration.");
                return false;
            }

            logger.LogInformation("Jellyfin Featured registered its File Transformation patch.");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to register Jellyfin Featured with File Transformation.");
            return false;
        }
    }

    private static MethodInfo? FindRegisterMethod()
    {
        Assembly? assembly = AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(candidate => candidate.FullName?.Contains(".FileTransformation", StringComparison.OrdinalIgnoreCase) ?? false);
        return assembly?.GetType(InterfaceTypeName)?.GetMethod("RegisterTransformation");
    }
}
