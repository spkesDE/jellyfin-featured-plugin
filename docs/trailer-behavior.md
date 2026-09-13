# Trailer behavior and troubleshooting

## Candidate order and fallback

A valid manual override is considered first. Remaining candidates follow the configured source priority:

- `Local only`: visible Jellyfin trailer items only.
- `Remote only`: supported remote URLs only.
- `Prefer local`: local trailers first, followed by remote trailers when remote fallback is enabled.
- `Prefer remote`: remote trailers first, followed by local trailers.
- `Automatic`: local trailers first, followed by remote trailers.

When multiple trailers are available, the configured mode either preserves their order or randomizes it. If background playback fails for one candidate, the carousel tries the next candidate for that title. Unsupported external pages remain usable through the trailer/details action but cannot play as background video.

## YouTube limitations

YouTube background playback uses an embedded player. A particular video can fail when it is private, removed, age- or region-restricted, or has embedding disabled by its owner. Those failures affect only that video and do not disable the YouTube host for other titles.

Browser tracking protection, DNS filtering, firewalls, content blockers, or restricted client webviews can also prevent the player API or iframe from loading. The plugin first tries YouTube's privacy-enhanced host and can fall back to the standard embed host for host-level loading failures.

## Local and direct-video trailers

Local Jellyfin trailer items retain the active user's visibility permissions. Direct HTTP video URLs require a browser-playable format and server headers that permit playback. Mobile background trailers remain disabled by default because autoplay and codec support vary substantially between clients.
