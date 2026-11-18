using Jellyfin.Data.Events.Users;
using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Events;

namespace Jellyfin.Plugin.Featured;

/// <summary>Drops a deleted user's preferences, dismissals and display history.</summary>
public sealed class FeaturedUserDeletedConsumer : IEventConsumer<UserDeletedEventArgs>
{
    private readonly FeaturedUserDataCleanup _cleanup;

    public FeaturedUserDeletedConsumer(FeaturedUserDataCleanup cleanup)
    {
        _cleanup = cleanup;
    }

    public Task OnEvent(UserDeletedEventArgs eventArgs)
    {
        ArgumentNullException.ThrowIfNull(eventArgs);
        _cleanup.RemoveUser(eventArgs.Argument.Id);
        return Task.CompletedTask;
    }
}
