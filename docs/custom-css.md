# Custom CSS and theming

Jellyfin Featured uses Jellyfin's colors by default. Add the `--featured-*` variables below under **Dashboard > General > Custom CSS** to override them.

> [!NOTE]
> You do not need Custom CSS for the plugin to match your theme. `!important` is normally not required.

## Quick example

```css
:root {
  --featured-theme-primary: #ff9f1c;
  --featured-theme-primary-dark: #e38300;
  --featured-theme-primary-contrast: #15100a;
  --featured-theme-radius: 0.75rem;
}

.featured-root {
  --featured-banner-radius: 28px;
  --featured-button-primary-background: linear-gradient(135deg, #ff9f1c, #ff4d6d);
  --featured-button-primary-hover-background: #ff4d6d;
  --featured-button-primary-color: #fff;
  --featured-button-secondary-background: rgb(0 0 0 / 0.58);
  --featured-button-secondary-hover-background: rgb(0 0 0 / 0.78);
  --featured-button-secondary-color: #fff;
  --featured-button-radius: 999px;
  --featured-button-border: 1px solid rgb(255 255 255 / 0.28);
  --featured-button-shadow: 0 0.35rem 1rem rgb(0 0 0 / 0.32);
}
```

> [!TIP]
> Use `:root` everywhere, `.featured-root` for the banner, `.featured-preferences-backdrop` for user settings, or `#FeaturedConfigPage` for the admin page and preview.

## Theme variables

| Variable                              | Used for                             |
| ------------------------------------- | ------------------------------------ |
| `--featured-theme-primary`            | Primary controls and selected states |
| `--featured-theme-primary-dark`       | Primary hover state                  |
| `--featured-theme-primary-contrast`   | Text on the primary color            |
| `--featured-theme-secondary`          | Focus outlines and secondary accents |
| `--featured-theme-secondary-contrast` | Text on the secondary color          |
| `--featured-theme-background`         | Dialog and page backgrounds          |
| `--featured-theme-paper`              | Raised surfaces and footer areas     |
| `--featured-theme-appbar`             | Dialog headers                       |
| `--featured-theme-text-primary`       | Main interface text                  |
| `--featured-theme-text-secondary`     | Muted interface text                 |
| `--featured-theme-divider`            | Borders and separators               |
| `--featured-theme-action-hover`       | Hovered rows and controls            |
| `--featured-theme-action-focus`       | Focused controls                     |
| `--featured-theme-contained`          | Neutral contained buttons            |
| `--featured-theme-contained-hover`    | Neutral contained-button hover state |
| `--featured-theme-error`              | Error and excluded states            |
| `--featured-theme-error-light`        | Error text and borders               |
| `--featured-theme-error-contrast`     | Text on error backgrounds            |
| `--featured-theme-radius`             | Default control and surface radius   |

Variables you do not set keep their Jellyfin or default value.

## Component variables

| Variable                                       | Used for                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `--featured-banner-radius`                     | Carousel viewport and slide clipping, including active trailers |
| `--featured-button-primary-background`         | Play/details primary button background                          |
| `--featured-button-primary-hover-background`   | Primary button hover/focus background                           |
| `--featured-button-primary-color`              | Primary button text and icon color                              |
| `--featured-button-secondary-background`       | Secondary button background                                     |
| `--featured-button-secondary-hover-background` | Secondary button hover/focus background                         |
| `--featured-button-secondary-color`            | Secondary button text and icon color                            |
| `--featured-button-radius`                     | Primary and secondary button radius                             |
| `--featured-button-border`                     | Primary and secondary button border                             |
| `--featured-button-shadow`                     | Primary and secondary button shadow                             |
| `--featured-dialog-background`                 | Preferences dialog background                                   |
| `--featured-dialog-color`                      | Preferences dialog text                                         |
| `--featured-dialog-border`                     | Preferences dialog outer border                                 |
| `--featured-dialog-radius`                     | Preferences dialog radius                                       |
| `--featured-dialog-shadow`                     | Preferences dialog shadow                                       |
| `--featured-dialog-header-background`          | Preferences dialog header                                       |
| `--featured-dialog-footer-background`          | Preferences dialog action footer                                |

Component variables you do not set use the matching theme value. Button changes also appear in the admin preview.

## Direct selectors

You can also use the `featured-*` classes directly. Start with `.featured-root` or `.featured-preferences-backdrop` so the rule does not affect the rest of Jellyfin.

| Area                | Selectors                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carousel shell      | `.featured-root`, `.featured-heading`, `.featured-viewport`, `.featured-track`, `.featured-slide`                                                                  |
| Artwork and trailer | `.featured-backdrop`, `.featured-trailer`, `.featured-youtube-frame`                                                                                               |
| Copy                | `.featured-content`, `.featured-logo`, `.featured-title`, `.featured-tagline`, `.featured-meta`, `.featured-overview`                                              |
| Actions             | `.featured-actions`, `.featured-button`, `.featured-button-secondary`                                                                                              |
| Navigation          | `.featured-navigation`, `.featured-controls`, `.featured-control`, `.featured-dots`, `.featured-dot`                                                               |
| Preferences         | `.featured-preferences-backdrop`, `.featured-preferences-dialog`, `.featured-preferences-header`, `.featured-preferences-content`, `.featured-preferences-actions` |
| Preference fields   | `.featured-preference-source`, `.featured-preference-genre`, `.featured-preference-genre-marker`, `.featured-preference-boosts`                                    |

State selectors: `.featured-hero`, `.featured-ready`, `.featured-trailer-active`, `.featured-controls-hover`, `.is-active`, `[data-genre-state="preferred"]`, and `[data-genre-state="excluded"]`.

For example:

```css
.featured-root .featured-title {
  font-family: Georgia, serif;
  letter-spacing: 0.02em;
}

.featured-root .featured-button-secondary {
  backdrop-filter: blur(12px);
}

.featured-root .featured-dot.is-active {
  transform: scale(1.35);
}
```

> [!WARNING]
> Use `--featured-*` variables and `.featured-*` selectors where possible. Jellyfin's own classes can change after an update.
