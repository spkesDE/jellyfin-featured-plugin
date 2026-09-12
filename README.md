# Jellyfin Featured

![Jellyfin Featured banner](./banner.png)

Jellyfin Featured adds a large, rotating banner to your Jellyfin home page. Use it to highlight favourites, new additions, collections, playlists, or anything else you want people on your server to discover.

## What you can do

- Fill the banner from libraries, collections, playlists, favourites, tags, recent additions, new releases, unplayed titles or your own hand-picked list.
- Mix several sources and decide how often each one should appear.
- Narrow the selection by genre, year, age rating, play status, runtime and more.
- Give each Jellyfin user more of what they like, including favourites, unwatched titles, preferred genres and series they have already started.
- Choose between a classic banner and a larger hero layout, then adjust the height, artwork, text, buttons and transitions.
- Rotate titles automatically, load more while browsing, or play muted local trailers in the background.

Jellyfin Featured works in Jellyfin Web and clients that display the Jellyfin Web interface. Some native TV apps use their own home screen and cannot show the banner.

## Requirements

- Jellyfin Server 12
- One of these companion plugins:
  - [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation), or
  - [JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector)

## Installation

You need Jellyfin Featured and one companion plugin. File Transformation is recommended, but JavaScript Injector works as well.

### Jellyfin Featured

1. In Jellyfin, open `Dashboard -> Catalog -> Settings`.
2. Add the following plugin repository:

   ```text
   https://raw.githubusercontent.com/spkesDE/jellyfin-featured-plugin/main/manifest.json
   ```

3. Save the repository, return to the plugin catalog, and install `Jellyfin Featured`.
4. Restart Jellyfin.

### File Transformation

1. Add the File Transformation repository:

   ```text
   https://www.iamparadox.dev/jellyfin/plugins/manifest.json
   ```

2. Install `File Transformation`.
3. Restart Jellyfin.

### JavaScript Injector (alternative)

1. Add the JavaScript Injector repository:

   ```text
   https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json
   ```

2. Install `JavaScript Injector`.
3. Restart Jellyfin.

That is all the setup JavaScript Injector needs. You do not have to copy or paste any scripts.

Only one companion plugin is required. If both are installed, leave the injection method set to `Automatic`; Jellyfin Featured will use File Transformation. You can also choose either plugin yourself in the settings.

Restart Jellyfin after changing the frontend injection method.

## Setup

1. Open the Jellyfin admin dashboard.
2. Open the `Jellyfin Featured` plugin settings.
3. Choose where the featured titles should come from.
4. Add any filters you want and adjust how often each source should appear.
5. Choose a layout and customise the banner to your taste.
6. Save the configuration.
7. Refresh Jellyfin Web.

A random selection is enabled by default, so you should see the banner without having to create any rules first.

## Content Sources

| Source | Best for |
|---|---|
| Libraries | Titles from selected Jellyfin libraries |
| Collections | Curated groups and franchises |
| Favourites | Items marked as favourites |
| Tags | Anything grouped with a Jellyfin tag |
| Playlists | Existing Jellyfin playlists |
| Recently Added | Newly added library content |
| Latest Releases | Recently released media |
| Random | A changing mix of eligible titles |
| Unplayed | Content the user has not watched or played |
| Manual Lists | Your own hand-picked and ordered selection |

You can combine as many sources as you like. Give a source more weight if you want its titles to appear more often. Filters can apply to the whole banner or only to one source.

## Display Options

The default hero layout is designed to work without much tweaking. If you want a different look, you can change the banner height, artwork position, text alignment, gradients, corners, spacing, and transition style. Separate height settings are available for desktop, tablet, and mobile screens.

You can also choose which details and controls are shown, including the title or logo, description, rating, year, runtime, buttons, arrows, and page dots. Autoplay, background trailers, and the number of featured titles are optional.

## Troubleshooting

If the featured carousel does not appear:

1. Make sure `Jellyfin Featured` and either `File Transformation` or `JavaScript Injector` are installed and enabled.
2. Restart Jellyfin after installing or updating plugins.
3. Hard-refresh Jellyfin Web in your browser.
4. Make sure at least one content source is enabled and contains something the banner can show.
5. Temporarily remove your filters to check whether they are hiding every title.
6. If both injection plugins are installed, leave the injection method on `Automatic` or select one explicitly.
7. If the problem remains, enable debug logging in the plugin settings and check the Jellyfin log.

If the banner appears in a browser but not in a TV app, that app probably uses its own home screen and cannot display Jellyfin Featured.

For details about recent releases, see the [changelog](./CHANGELOG.md).

## License

This project is licensed under the [MIT License](./LICENSE).

## Credits

Jellyfin Featured is a remake of the original [Jellyfin Editor's Choice plugin](https://github.com/lachlandcp/jellyfin-editors-choice-plugin) by [lachlandcp](https://github.com/lachlandcp). Thanks to the original project for the idea and foundation.

## Contributing

Want to help improve Jellyfin Featured? See the [contributing guide](./CONTRIBUTING.md). If you want to build the plugin yourself, follow the [build guide](./BUILD.md).

## More Jellyfin plugins

Check out my other plugin: [Jellyfin Media Preview](https://github.com/spkesDE/jellyfin-media-preview-plugin).

## Star History

<a href="https://www.star-history.com/?repos=spkesde%2Fjellyfin-featured-plugin&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=spkesde/jellyfin-featured-plugin&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=spkesde/jellyfin-featured-plugin&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=spkesde/jellyfin-featured-plugin&type=date&legend=top-left" />
 </picture>
</a>
