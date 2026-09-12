using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured;

public sealed class FrontendRegistrationHostedService : BackgroundService
{
    private const int MaxAttempts = 12;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);
    private readonly ILogger<FrontendRegistrationHostedService> _logger;

    public FrontendRegistrationHostedService(ILogger<FrontendRegistrationHostedService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        for (int attempt = 1; attempt <= MaxAttempts && !stoppingToken.IsCancellationRequested; attempt += 1)
        {
            if (FrontendRegistration.TryRegisterConfigured(_logger))
            {
                return;
            }

            if (attempt < MaxAttempts)
            {
                _logger.LogInformation(
                    "Retrying Jellyfin Featured frontend registration in {DelaySeconds} seconds (attempt {NextAttempt}/{MaxAttempts}).",
                    RetryDelay.TotalSeconds,
                    attempt + 1,
                    MaxAttempts);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }

        _logger.LogWarning(
            "Jellyfin Featured could not register a frontend loader. Install File Transformation or JavaScript Injector.");
    }
}
