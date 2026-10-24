using System.Net;
using Jellyfin.Plugin.Featured.Api;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class YouTubeTrailerQualityTests
{
    [Theory]
    [InlineData("hd", "hd")]
    [InlineData("sd", "sd")]
    [InlineData("future-format", "unknown")]
    public async Task UsesOfficialDefinitionMetadataAndCachesResults(string definition, string expected)
    {
        using StubHttpFactory factory = new(() => Task.FromResult(JsonResponse(
            $"{{\"items\":[{{\"contentDetails\":{{\"definition\":\"{definition}\"}}}}]}}")));
        using YouTubeTrailerQualityService service = new(factory, () => "server-only-secret");

        Assert.Equal(expected, await service.GetQualityAsync("example1234"));
        Assert.Equal(expected, await service.GetQualityAsync("example1234"));
        Assert.Equal(1, factory.Handler.RequestCount);
        Assert.Equal("server-only-secret", factory.Handler.ApiKey);
        Assert.DoesNotContain("secret", factory.Handler.Url);
        Assert.StartsWith("https://www.googleapis.com/youtube/v3/videos?", factory.Handler.Url);
        Assert.Contains("part=contentDetails", factory.Handler.Url);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("{\"items\":[]}")]
    [InlineData("{\"items\":[{}]}")]
    [InlineData("{\"items\":[null]}")]
    [InlineData("{\"items\":[{\"contentDetails\":{\"definition\":720}}]}")]
    [InlineData("not json")]
    public async Task MissingOrMalformedMetadataIsUnknownAndCached(string json)
    {
        using StubHttpFactory factory = new(() => Task.FromResult(JsonResponse(json)));
        using YouTubeTrailerQualityService service = new(factory, () => "secret");
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
        Assert.Equal(1, factory.Handler.RequestCount);
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task ApiFailuresAreUnknownAndCached(HttpStatusCode status)
    {
        using StubHttpFactory factory = new(() => Task.FromResult(new HttpResponseMessage(status)));
        using YouTubeTrailerQualityService service = new(factory, () => "secret");
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
        Assert.Equal(1, factory.Handler.RequestCount);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task NetworkErrorsAndTimeoutsAreUnknown(bool timeout)
    {
        using StubHttpFactory factory = new(() => timeout
            ? Task.FromException<HttpResponseMessage>(new TaskCanceledException())
            : Task.FromException<HttpResponseMessage>(new HttpRequestException("offline")));
        using YouTubeTrailerQualityService service = new(factory, () => "secret");
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
    }

    [Fact]
    public async Task ConcurrentRequestsShareOneLookupAndCacheIsPerVideo()
    {
        TaskCompletionSource<HttpResponseMessage> completion = new(TaskCreationOptions.RunContinuationsAsynchronously);
        using StubHttpFactory factory = new(() => completion.Task);
        using YouTubeTrailerQualityService service = new(factory, () => "secret");
        Task<string> first = service.GetQualityAsync("example1234");
        Task<string> second = service.GetQualityAsync("example1234");
        Assert.Same(first, second);
        Assert.Equal(1, factory.Handler.RequestCount);
        completion.SetResult(JsonResponse("{\"items\":[{\"contentDetails\":{\"definition\":\"hd\"}}]}"));
        Assert.Equal(["hd", "hd"], await Task.WhenAll(first, second));
        // A different video must not reuse the first video's quality.
        factory.Handler.Respond = () => Task.FromResult(JsonResponse("{\"items\":[{\"contentDetails\":{\"definition\":\"sd\"}}]}"));
        Assert.Equal("sd", await service.GetQualityAsync("another1234"));
        Assert.Equal("hd", await service.GetQualityAsync("example1234"));
        Assert.Equal(2, factory.Handler.RequestCount);
    }

    [Fact]
    public async Task MissingKeyDoesNotMakeRequestsOrPreventLaterConfiguration()
    {
        string? apiKey = null;
        using StubHttpFactory factory = new(() => Task.FromResult(JsonResponse("{\"items\":[{\"contentDetails\":{\"definition\":\"sd\"}}]}")));
        using YouTubeTrailerQualityService service = new(factory, () => apiKey);
        Assert.Equal("unknown", await service.GetQualityAsync("example1234"));
        Assert.Equal(0, factory.Handler.RequestCount);
        apiKey = "secret";
        Assert.Equal("sd", await service.GetQualityAsync("example1234"));
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("server-only-secret", true)]
    public void KeyPresenceDoesNotCallYouTube(string? apiKey, bool expected)
    {
        using StubHttpFactory factory = new(() => throw new InvalidOperationException("Must not request"));
        using YouTubeTrailerQualityService service = new(factory, () => apiKey);
        Assert.Equal(expected, service.ApiKeyConfigured);
        Assert.Equal(0, factory.Handler.RequestCount);
    }

    [Theory]
    [InlineData("https://attacker.test/video")]
    [InlineData("x&key=secret")]
    [InlineData("short")]
    [InlineData("überlong1234")]
    public async Task InvalidIdsDoNotMakeRequests(string videoId)
    {
        using StubHttpFactory factory = new(() => throw new InvalidOperationException("Must not request"));
        using YouTubeTrailerQualityService service = new(factory, () => "secret");
        Assert.Equal("unknown", await service.GetQualityAsync(videoId));
        Assert.Equal(0, factory.Handler.RequestCount);
    }

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK) { Content = new StringContent(json) };

    private sealed class StubHttpFactory(Func<Task<HttpResponseMessage>> respond) : IHttpClientFactory, IDisposable
    {
        public StubHandler Handler { get; } = new(respond);
        public HttpClient CreateClient(string name) => new(Handler, disposeHandler: false);
        public void Dispose() => Handler.Dispose();
    }

    private sealed class StubHandler(Func<Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        public Func<Task<HttpResponseMessage>> Respond { get; set; } = respond;
        public int RequestCount { get; private set; }
        public string Url { get; private set; } = string.Empty;
        public string ApiKey { get; private set; } = string.Empty;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            Url = request.RequestUri!.OriginalString;
            ApiKey = request.Headers.GetValues("X-Goog-Api-Key").Single();
            return Respond();
        }
    }
}
