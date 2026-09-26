using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

/// <summary>
/// Owns the shared file-system mechanics for the plugin's small JSON stores.
/// Domain stores remain responsible for locking, validation, snapshots and save timing.
/// </summary>
/// <typeparam name="T">The serialized root value.</typeparam>
internal sealed class AtomicJsonFileStore<T>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _filePath;
    private readonly string _description;
    private readonly ILogger _logger;

    internal AtomicJsonFileStore(string filePath, string description, ILogger logger)
    {
        _filePath = filePath;
        _description = description;
        _logger = logger;
    }

    internal T Load(Func<T> createEmpty, Func<T, T>? normalize = null)
    {
        if (!File.Exists(_filePath)) return createEmpty();

        try
        {
            T? loaded = JsonSerializer.Deserialize<T>(File.ReadAllText(_filePath), JsonOptions);
            if (loaded is null) return createEmpty();
            return normalize is null ? loaded : normalize(loaded);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read Jellyfin Featured {Description}; starting with an empty store.", _description);
            return createEmpty();
        }
    }

    internal void Save(T snapshot)
    {
        try
        {
            string directory = Path.GetDirectoryName(_filePath)!;
            Directory.CreateDirectory(directory);
            string temporaryPath = _filePath + ".tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(snapshot, JsonOptions));
            File.Move(temporaryPath, _filePath, true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not persist Jellyfin Featured {Description}.", _description);
        }
    }
}
