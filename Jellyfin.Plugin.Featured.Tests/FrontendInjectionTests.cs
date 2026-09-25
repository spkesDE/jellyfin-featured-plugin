using System.Reflection;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FrontendInjectionTests : IDisposable
{
    private readonly string _temporaryPath = Path.Combine(Path.GetTempPath(), "featured-injection-tests", Guid.NewGuid().ToString("N"));

    public FrontendInjectionTests()
    {
        Directory.CreateDirectory(_temporaryPath);
    }

    [Fact]
    public void AutomaticUsesJavaScriptInjectorWhenFileTransformationIsNotActive()
    {
        FrontendInjectionAvailability availability = new(true, false, true, true);

        IReadOnlyList<string> candidates = FrontendRegistration.GetAutomaticCandidates(availability);

        Assert.Equal([FrontendInjectionMethods.JavaScriptInjector, FrontendInjectionMethods.Direct], candidates);
    }

    [Fact]
    public void AutomaticFallsBackToDirectInjectionWithoutHelperPlugins()
    {
        FrontendInjectionAvailability availability = new(true, false, false, true);

        Assert.Equal(
            [FrontendInjectionMethods.Direct],
            FrontendRegistration.GetAutomaticCandidates(availability));
    }

    [Fact]
    public void ConfigurationNormalizationRetainsDirectInjection()
    {
        PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(new PluginConfiguration
        {
            FrontendInjectionMethod = FrontendInjectionMethods.Direct
        });

        Assert.Equal(FrontendInjectionMethods.Direct, configuration.FrontendInjectionMethod);
    }

    [Fact]
    public void DirectInjectionIsIdempotentAndReplacesAnExistingFeaturedTag()
    {
        string indexFile = Path.Combine(_temporaryPath, "index.html");
        File.WriteAllText(indexFile, "<html><head></head><body><main></main><script plugin=\"Featured\" src=\"/old\"></script></body></html>");
        IApplicationPaths paths = DispatchProxy.Create<IApplicationPaths, ApplicationPathsStub>();
        ((ApplicationPathsStub)paths).WebPath = _temporaryPath;

        Assert.True(DirectScriptInjector.TryInject(paths, NullLogger.Instance));
        string first = File.ReadAllText(indexFile);
        Assert.True(DirectScriptInjector.TryInject(paths, NullLogger.Instance));
        string second = File.ReadAllText(indexFile);

        Assert.Equal(first, second);
        Assert.DoesNotContain("src=\"/old\"", second, StringComparison.Ordinal);
        Assert.Contains("DirectInjection=\"true\"", second, StringComparison.Ordinal);
        Assert.Contains("src=\"/featured/script\"", second, StringComparison.Ordinal);
        Assert.Equal(1, CountOccurrences(second, "plugin=\"Featured\""));
    }

    public void Dispose()
    {
        if (Directory.Exists(_temporaryPath))
        {
            Directory.Delete(_temporaryPath, true);
        }

        GC.SuppressFinalize(this);
    }

    private static int CountOccurrences(string value, string search)
        => (value.Length - value.Replace(search, string.Empty, StringComparison.Ordinal).Length) / search.Length;

    public class ApplicationPathsStub : DispatchProxy
    {
        public string WebPath { get; set; } = string.Empty;

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
            => targetMethod?.Name == "get_WebPath"
                ? WebPath
                : targetMethod?.ReturnType is { IsValueType: true } returnType
                    ? Activator.CreateInstance(returnType)
                    : null;
    }
}
