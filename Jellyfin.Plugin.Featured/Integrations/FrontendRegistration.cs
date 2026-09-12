using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured;

internal static class FrontendRegistration
{
    internal static bool LastRegistrationSucceeded { get; private set; }

    internal static string ActiveMethod { get; private set; } = "none";

    internal static bool TryRegisterConfigured(ILogger logger)
    {
        PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);

        bool succeeded;
        string activeMethod;

        switch (configuration.FrontendInjectionMethod)
        {
            case FrontendInjectionMethods.FileTransformation:
                JavaScriptInjectorRegistrar.TrySetEnabled(logger, false);
                succeeded = FileTransformationRegistrar.TryRegister(logger);
                activeMethod = succeeded ? FrontendInjectionMethods.FileTransformation : "none";
                break;

            case FrontendInjectionMethods.JavaScriptInjector:
                succeeded = JavaScriptInjectorRegistrar.TryRegister(logger);
                activeMethod = succeeded ? FrontendInjectionMethods.JavaScriptInjector : "none";
                break;

            default:
                if (FileTransformationRegistrar.TryRegister(logger))
                {
                    JavaScriptInjectorRegistrar.TrySetEnabled(logger, false);
                    succeeded = true;
                    activeMethod = FrontendInjectionMethods.FileTransformation;
                    break;
                }

                succeeded = JavaScriptInjectorRegistrar.TryRegister(logger);
                activeMethod = succeeded ? FrontendInjectionMethods.JavaScriptInjector : "none";
                break;
        }

        LastRegistrationSucceeded = succeeded;
        ActiveMethod = activeMethod;
        return succeeded;
    }
}
