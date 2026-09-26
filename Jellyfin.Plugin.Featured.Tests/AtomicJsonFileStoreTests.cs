using Jellyfin.Plugin.Featured.Api;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class AtomicJsonFileStoreTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "JellyfinFeaturedTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void SaveReplacesTheSnapshotAndLeavesNoTemporaryFile()
    {
        string path = Path.Combine(_directory, "state.json");
        AtomicJsonFileStore<Dictionary<string, int>> store = new(path, "test state", NullLogger.Instance);

        store.Save(new Dictionary<string, int> { ["old"] = 1 });
        store.Save(new Dictionary<string, int> { ["new"] = 2 });

        Dictionary<string, int> loaded = store.Load(() => []);
        Assert.Equal(2, loaded["new"]);
        Assert.False(loaded.ContainsKey("old"));
        Assert.False(File.Exists(path + ".tmp"));
    }

    [Fact]
    public void InvalidJsonReturnsAnEmptyDomainSnapshot()
    {
        Directory.CreateDirectory(_directory);
        string path = Path.Combine(_directory, "state.json");
        File.WriteAllText(path, "not-json");
        AtomicJsonFileStore<List<string>> store = new(path, "test state", NullLogger.Instance);

        List<string> loaded = store.Load(() => ["fallback"]);

        Assert.Equal(["fallback"], loaded);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory)) Directory.Delete(_directory, true);
        GC.SuppressFinalize(this);
    }
}
