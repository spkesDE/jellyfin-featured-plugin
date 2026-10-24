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

### Optional YouTube quality filter

Under **Trailers → YouTube Quality Filter**, choose **Disabled** (default) or **HD Only (720p+)**.
Each source rule can **Inherit** this setting (default), force it **Enabled**, or force it **Disabled**.
The source override takes priority over the global setting; older configurations keep filtering disabled.

Quality is checked immediately before a YouTube candidate starts. Confirmed SD-only trailers are skipped using
the normal fallback order, including subsequent trailers, local media, excerpts, and Trickplay where configured.
If all candidates are skipped, the still image returns and carousel autoplay resumes.

The metadata lookup uses the official [YouTube Data API `contentDetails.definition`](https://developers.google.com/youtube/v3/docs/videos#contentDetails.definition).
`hd` confirms availability at 720p or higher; `sd` means the video only offers standard definition.
This metadata establishes the 720p threshold, rather than an exact maximum pixel height or the resolution
the embedded player will select. It does not force the player's streaming quality.

The API key is optional. To enable actual quality detection, [create an API key in Google Cloud](https://console.cloud.google.com/apis/credentials) and enable YouTube Data API v3 for it,
set `JELLYFIN_FEATURED_YOUTUBE_API_KEY` in the **Jellyfin server process environment**, and restart Jellyfin.
For Docker, add this variable to the Jellyfin container environment and recreate the container.
The key remains on the server and is sent to Google in a redacted HTTP header; it is never sent to the frontend.
Without a key, no metadata requests are made and all trailers remain playable.
The settings page checks whether the server environment contains a nonempty key and displays
“Kein .env key detected” in German when it is missing. This presence check does not validate the key with Google.

The backend shares a bounded, in-memory cache across users and sources: known results expire after 24 hours,
unknown results after five minutes, and concurrent requests for a video share one lookup. Upstream requests
time out after three seconds. Missing metadata, private/deleted videos, API errors, exhausted quota, and
timeouts allow playback. The existing playback-error fallback still handles trailers that cannot play.

## Local and direct video

Local trailers follow the user's Jellyfin permissions. Direct links need a format and server configuration that the browser can play.

> [!NOTE]
> Background trailers are off on mobile by default. Autoplay and video support differ between devices.
