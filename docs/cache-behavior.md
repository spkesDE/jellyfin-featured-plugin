# Cache behavior

Jellyfin Featured uses two server caches, a small browser cache, and a separate repeat history.

> [!NOTE]
> Caching is automatic. Leave it alone unless you are troubleshooting.

## Candidate Cache

Keeps the titles found for each source before filters and mixing are applied. User-specific sources have their own entries.

## Prepared Cache

Keeps a ready-to-use list for each user, so the plugin does not rebuild it on every request.

The list is refreshed when settings change. If it can no longer be used, the plugin builds the request normally and refreshes the cache.

Configurations that require live mixing cannot reuse a finished list. For those configurations, the startup task still warms the expensive source candidates and leaves only the final lightweight mixing work for each request.

## Browser Startup Cache

The browser keeps up to five featured items for the current server and user in local storage. On a reload, these items can be painted immediately while a fresh request runs in the background. Fresh data replaces the cached list without changing the item currently visible to the viewer.

Rapid home-screen remounts reuse the latest fresh response in memory for 30 seconds. Concurrent remounts also share one in-flight request, preventing Jellyfin client reconnects from creating a burst of identical server work.

The startup cache expires after 24 hours, at the next preset boundary, or when user settings or the plugin version change. If local storage is unavailable, the carousel continues with the normal server request.

## Repeat Cooldown

Repeat Cooldown records recently shown titles and hides them for the selected period. The carousel also avoids loading the same title twice in one session.

> [!IMPORTANT]
> Clearing a cache does not reset Repeat Cooldown history.

> [!TIP]
> The plugin diagnostics show cache hits, misses, and refreshes.
