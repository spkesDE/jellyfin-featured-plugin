# Jellyfin Featured

![Jellyfin Featured banner](./banner.png)

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/spkesDE/jellyfin-featured-plugin?color=00A4DC&amp;cacheSeconds=3600" /></a>
  <a href="https://github.com/spkesDE/jellyfin-featured-plugin/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/spkesDE/jellyfin-featured-plugin?color=AA5CC3&amp;cacheSeconds=3600" /></a>
  <img alt="Jellyfin version" src="https://img.shields.io/badge/Jellyfin-12.x-AA5CC3?labelColor=555&amp;logo=jellyfin&amp;logoColor=00A4DC&amp;cacheSeconds=3600" />
  <img alt="Downloads" src="https://img.shields.io/github/downloads/spkesDE/jellyfin-featured-plugin/total?color=AA5CC3&amp;cacheSeconds=3600" />
</p>

Jellyfin Featured adds a rotating hero banner to the Jellyfin home page.

## Features

- Use libraries, collections, playlists, favourites, tags, recent additions, or recommendations.
- Mix sources and filter by genre, year, age rating, play status, runtime, people, or language.
- Show different titles for each user based on favourites and watch history.
- Change the layout, artwork, text, controls, transitions, and trailers.
- Schedule presets for events, weekdays, or seasons.
- Preview the banner as another Jellyfin user.

> [!NOTE]
> The banner only appears in Jellyfin Web and clients that use the Jellyfin Web interface. Native apps with their own home screen cannot show it.

## Installation

1. In Jellyfin, open `Dashboard -> Catalog -> Settings`.
2. Add this plugin repository:

   ```text
   https://raw.githubusercontent.com/spkesDE/jellyfin-featured-plugin/main/manifest.json
   ```

3. Install **Jellyfin Featured** from the plugin catalog.
4. Restart Jellyfin.

> [!IMPORTANT]
> For the frontend, install either [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) or [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector). Both are supported.

### Frontend helper repositories

**File Transformation:**

```text
https://www.iamparadox.dev/jellyfin/plugins/manifest.json
```

**JavaScript Injector:**

```text
https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json
```

> [!TIP]
> Keep the injection method set to `Automatic`. The plugin will use whichever frontend helper is installed.

> [!WARNING]
> If neither helper is installed, the plugin writes its loader to `jellyfin-web/index.html` at startup. The Jellyfin service account needs write access. After a Jellyfin update, the loader is added again on the next start.

## Setup

1. Open `Dashboard -> Plugins -> Jellyfin Featured`.
2. Select the content you want to feature.
3. Adjust filters and appearance if needed.
4. Save, then refresh Jellyfin Web.

> [!NOTE]
> The default setup uses a random selection. No source rules are needed for the first start.

Users can open **Featured settings** from their Jellyfin user menu. Administrators decide which personalization options users may change.

## Trailers

Background trailers can use local files, direct video links, or YouTube. Trailer order, mute, delay, and mobile playback can be changed in the plugin settings.

> [!WARNING]
> Some YouTube videos block embedded playback. See [Trailer behavior and troubleshooting](./docs/trailer-behavior.md).

## Troubleshooting

If the banner does not appear:

1. Confirm that Jellyfin Featured and your frontend helper are installed and enabled.
2. Restart Jellyfin, then hard-refresh the browser.
3. Check that at least one content source returns titles.
4. Temporarily disable filters.
5. Keep the injection method on `Automatic`.
6. Turn on debug logging in the plugin settings and check the Jellyfin log.

If it works in a browser but not in a TV app, that app probably uses its own home screen.

> [!TIP]
> When reporting a problem, include the Jellyfin version, plugin version, selected injection method, and relevant log lines.

## More information

> [!TIP]
> Like Jellyfin Featured? Check out my other plugin: [**Jellyfin Media Preview**](https://github.com/spkesDE/jellyfin-media-preview-plugin).

- [Custom CSS and theming](./docs/custom-css.md)
- [Cache behavior](./docs/cache-behavior.md)
- [Changelog](./CHANGELOG.md)
- [Contributing and translations](./CONTRIBUTING.md)

The interface is available in English and German and follows the Jellyfin or browser language automatically.

## License and credits

Licensed under the [MIT License](./LICENSE).

Jellyfin Featured is a remake of the original [Jellyfin Editor's Choice plugin](https://github.com/lachlandcp/jellyfin-editors-choice-plugin) by [lachlandcp](https://github.com/lachlandcp).
