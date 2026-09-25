using System.Globalization;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured;

public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static readonly Guid PluginGuid = Guid.Parse("08880a95-8467-4538-bab9-da69c7f4793f");
    private const string ConfigurationPageName = "FeaturedConfigPage";
    private readonly IApplicationPaths _applicationPaths;
    private readonly ILogger<Plugin> _logger;

    public Plugin(
        IApplicationPaths applicationPaths,
        IXmlSerializer xmlSerializer,
        IServerConfigurationManager serverConfigurationManager,
        ILogger<Plugin> logger)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        _applicationPaths = applicationPaths;
        _logger = logger;
        ServerConfigurationManager = serverConfigurationManager;
    }

    public static Plugin? Instance { get; private set; }

    public IServerConfigurationManager ServerConfigurationManager { get; }

    public override string Name => "Jellyfin Featured";

    public override Guid Id => PluginGuid;

    public override string Description =>
        "Adds a configurable featured-content hero carousel to the Jellyfin Web home page.";

    public override void OnUninstalling()
    {
        DirectScriptInjector.TryRemove(_applicationPaths, _logger);
        base.OnUninstalling();
    }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = ConfigurationPageName,
                EmbeddedResourcePath = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}.Configuration.configPage.html",
                    GetType().Namespace)
            }
        };
    }
}
