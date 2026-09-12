# Changelog

## 12.1.0.0 - 2026-09-11

### Added

- Initial Jellyfin Featured release for Jellyfin 12.
- Add a configurable featured-content carousel with curated favourites, collections, recent releases, and random picks.
- Add standard and hero layouts, background trailers, filtering, and a live configuration preview.
- Add an authenticated diagnostics endpoint and a Test hero query action for injection, user, filter, and result-count troubleshooting.
- Add ordered source rules for libraries, collections, favourites, tags, playlists, recently added, random, and unplayed content.
- Add weighted source mixing plus composable global and per-source filters for library, genre, tag, media type, play state, ratings, year, and runtime.
- Refine source cards and filter spacing, replace expanding value panels with overlay multi-select dropdowns, and load collections, playlists, genres, and tags through a server-side options endpoint.
- Add manual featured lists with local title search, per-list and per-item scheduling, enable controls, and Vue-powered drag-and-drop ordering.
- Make manual lists selectable weighted sources, allowing mixes such as 90% curated titles and 10% random content without a global manual override.
- Support hero-ready music albums, music videos, videos, audiobooks, books, photos, and photo albums alongside movies and series, using primary artwork when no backdrop exists.
- Add a latest-releases source based on the actual premiere date, separate from Jellyfin's date-added source.
- Add largest-remainder source quotas with automatic quota donation plus a persistent per-user display cooldown recorded only for slides that were actually shown, including an admin multi-select for clearing selected users' histories.
- Add transparent per-user scoring profiles for unplayed items, favourites, preferred genres, and in-progress series.
- Simplify result limits so the fixed maximum is shown only when continuous loading is disabled, move feature-specific styles into their Vue components, and embed scoped component CSS in the production configuration bundle.
- Restrict the public runtime configuration payload to an explicit presentation-only whitelist so internal curation and user-profile data is never embedded in the client script.
- Add a native startup/hourly Jellyfin task that prepares shared source candidates and per-user featured pools, with asynchronous invalidation after configuration and display-history changes.
- Consolidate supported media types, display contracts, frontend defaults, item navigation, and configuration option mappers, backed by contract tests.
- Batch viewer-access checks, global-filter evaluation, and user-profile data reads while reusing shared candidate pools across users.

### Fixed

- Reserve the configured carousel space with a responsive loading placeholder so Jellyfin home rows no longer jump when featured items finish loading.
- Start reserving carousel space from the lightweight injection bootstrap, before the full frontend bundle loads, and prevent episode or season records from appearing as featured slides.
- Cache-bust the administration bundle while the unreleased plugin version remains unchanged, preventing Jellyfin Web from reusing an incompatible configuration script during development.
- Normalize card and help-text spacing, use the complete manual-title row as the drag preview, label each title's active state explicitly, and explain per-user scoring in three concrete steps.
- Render multi-select menus as viewport overlays with automatic upward/downward placement so cards and screen edges no longer clip them.
- Keep bootstrap and runtime placeholders aligned for custom, tablet, and mobile hero overlap values.
