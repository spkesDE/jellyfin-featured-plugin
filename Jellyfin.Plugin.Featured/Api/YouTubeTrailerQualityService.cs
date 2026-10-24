using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Jellyfin.Plugin.Featured.Api;

/// <summary>Shared, bounded cache of YouTube's HD availability, independent of source rules.</summary>
public sealed class YouTubeTrailerQualityService : IDisposable
{
    public const string ApiKeyEnvironmentVariable = "JELLYFIN_FEATURED_YOUTUBE_API_KEY";
    internal const string HttpClientName = "Featured.YouTubeQuality";
    private readonly IHttpClientFactory _httpClients;
    private readonly Func<string?> _getApiKey;
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 4096 });
    private readonly object _cacheLock = new();

    public YouTubeTrailerQualityService(IHttpClientFactory httpClients)
        : this(httpClients, () => Environment.GetEnvironmentVariable(ApiKeyEnvironmentVariable))
    {
    }

    internal YouTubeTrailerQualityService(IHttpClientFactory httpClients, Func<string?> getApiKey)
    {
        _httpClients = httpClients;
        _getApiKey = getApiKey;
    }

    public bool ApiKeyConfigured => !string.IsNullOrWhiteSpace(_getApiKey());

    public Task<string> GetQualityAsync(string videoId)
    {
        if (videoId.Length is < 6 or > 32
            || !videoId.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_'))
        {
            return Task.FromResult("unknown");
        }

        // Never send the key to clients, put it in a URL, or cache a missing configuration.
        string? apiKey = _getApiKey()?.Trim();
        if (string.IsNullOrEmpty(apiKey)) return Task.FromResult("unknown");
        lock (_cacheLock)
        {
            if (_cache.TryGetValue(videoId, out Lazy<Task<string>>? cached)) return cached!.Value;
            Lazy<Task<string>> lookup = new(() => FetchAsync(videoId, apiKey));
            _cache.Set(videoId, lookup, new MemoryCacheEntryOptions
            {
                Size = 1,
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
            });
            return lookup.Value;
        }
    }

    private async Task<string> FetchAsync(string videoId, string apiKey)
    {
        string quality = "unknown";
        try
        {
            using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(3));
            using HttpClient client = _httpClients.CreateClient(HttpClientName);
            using HttpRequestMessage request = new(HttpMethod.Get,
                $"https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={Uri.EscapeDataString(videoId)}&fields=items(contentDetails(definition))");
            request.Headers.Add("X-Goog-Api-Key", apiKey);
            using HttpResponseMessage response = await client.SendAsync(request, timeout.Token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            using Stream stream = await response.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
            using JsonDocument document = await JsonDocument.ParseAsync(stream, cancellationToken: timeout.Token).ConfigureAwait(false);
            quality = ReadQuality(document.RootElement);
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException or ArgumentException or IOException or FormatException)
        {
            // Unknown metadata (including quota/authentication failures) must allow playback.
            // Do not log upstream responses or exceptions that could contain credentials.
        }

        lock (_cacheLock)
        {
            _cache.Set(videoId, new Lazy<Task<string>>(() => Task.FromResult(quality)), new MemoryCacheEntryOptions
            {
                Size = 1,
                AbsoluteExpirationRelativeToNow = quality == "unknown" ? TimeSpan.FromMinutes(5) : TimeSpan.FromHours(24)
            });
        }
        return quality;
    }

    internal static string ReadQuality(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("items", out JsonElement items) || items.ValueKind != JsonValueKind.Array
            || items.GetArrayLength() != 1) return "unknown";
        JsonElement item = items[0];
        if (item.ValueKind != JsonValueKind.Object
            || !item.TryGetProperty("contentDetails", out JsonElement details) || details.ValueKind != JsonValueKind.Object
            || !details.TryGetProperty("definition", out JsonElement definition) || definition.ValueKind != JsonValueKind.String)
        {
            return "unknown";
        }
        return definition.GetString() switch { "hd" => "hd", "sd" => "sd", _ => "unknown" };
    }

    public void Dispose() => _cache.Dispose();
}
