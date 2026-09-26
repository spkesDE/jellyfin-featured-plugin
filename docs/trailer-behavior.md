# Trailer behavior and troubleshooting

Trailers can come from Jellyfin, a direct video link, or YouTube.

## Trailer order

A manual override is tried first. Other trailers use the selected order:

- `Local only`: Jellyfin trailer items
- `Remote only`: supported remote URLs
- `Prefer local`: local trailers, then remote trailers when fallback is enabled
- `Prefer remote`: remote trailers, then local trailers
- `Automatic`: local trailers, then remote trailers

> [!TIP]
> If a trailer fails, the next trailer for that title is tried.

Unsupported links can still open with the trailer or details button, but cannot play in the background.

## YouTube

> [!WARNING]
> YouTube videos cannot play when they are private, removed, restricted, or blocked from embedding.

Tracking protection, DNS filters, firewalls, content blockers, or the client itself can also block YouTube. Other YouTube trailers may still work.

## Local and direct video

Local trailers follow the user's Jellyfin permissions. Direct links need a format and server configuration that the browser can play.

> [!NOTE]
> Background trailers are off on mobile by default. Autoplay and video support differ between devices.
