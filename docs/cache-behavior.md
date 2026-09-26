# Cache behavior

Jellyfin Featured uses two caches and a separate repeat history.

> [!NOTE]
> Caching is automatic. Leave it alone unless you are troubleshooting.

## Candidate Cache

Keeps the titles found for each source before filters and mixing are applied. User-specific sources have their own entries.

## Prepared Cache

Keeps a ready-to-use list for each user, so the plugin does not rebuild it on every request.

The list is refreshed when settings change. If it can no longer be used, the plugin builds the request normally and refreshes the cache.

## Repeat Cooldown

Repeat Cooldown records recently shown titles and hides them for the selected period. The carousel also avoids loading the same title twice in one session.

> [!IMPORTANT]
> Clearing a cache does not reset Repeat Cooldown history.

> [!TIP]
> The plugin diagnostics show cache hits, misses, and refreshes.
