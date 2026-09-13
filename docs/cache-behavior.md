# Cache behavior

Jellyfin Featured uses three separate mechanisms. They intentionally have different lifetimes and responsibilities.

## Candidate Cache

The Candidate Cache remembers the library items found for a source rule before final user filtering, scoring, source mixing, and allocation. Shared sources can be reused between users; user-dependent sources use a user-scoped entry. It reduces repeated Jellyfin library queries but does not represent the final feed.

## Prepared Cache

The Prepared Cache stores a final eligible pool per Jellyfin user, including prepared response data. A valid hit can serve `/featured/items` without running the Rule Engine. Its fingerprint includes the effective configuration and every personalization value that changes selection.

Prepared items rotate through a shuffle bag before the pool repeats. Request exclusions and repeat history are still checked on every lookup. If too few eligible prepared items remain, the request safely falls back and queues a refresh.

Some mixer constraints require live allocation and intentionally bypass prepared entries. Debug timing reports distinguish `HIT`, missing entries, fingerprint changes, insufficient eligible items, live-mixing bypasses, and refreshes in progress. Fingerprints and user preferences are never written to the diagnostic message.

## Repeat Cooldown and display history

Repeat Cooldown is not a cache. When enabled, the plugin records displayed item IDs for the configured period and excludes them from later responses. It provides longer-term repeat protection across requests and prepared-pool refreshes.

Infinite-loading requests also send the IDs already held by the carousel. Those request exclusions prevent duplicates within the current browsing session, independently of Repeat Cooldown.
