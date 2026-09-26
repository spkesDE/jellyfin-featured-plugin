# Custom CSS and theming

Jellyfin Featured uses Jellyfin's colors by default. Add the `--ec-*` variables below under **Dashboard > General > Custom CSS** to override them.

> [!NOTE]
> You do not need Custom CSS for the plugin to match your theme. `!important` is normally not required.

## Quick example

```css
:root {
  --ec-theme-primary: #ff9f1c;
  --ec-theme-primary-dark: #e38300;
  --ec-theme-primary-contrast: #15100a;
  --ec-theme-radius: .75rem;
}

.ec-root {
  --ec-banner-radius: 28px;
  --ec-button-primary-background: linear-gradient(135deg, #ff9f1c, #ff4d6d);
  --ec-button-primary-hover-background: #ff4d6d;
  --ec-button-primary-color: #fff;
  --ec-button-secondary-background: rgb(0 0 0 / .58);
  --ec-button-secondary-hover-background: rgb(0 0 0 / .78);
  --ec-button-secondary-color: #fff;
  --ec-button-radius: 999px;
  --ec-button-border: 1px solid rgb(255 255 255 / .28);
  --ec-button-shadow: 0 .35rem 1rem rgb(0 0 0 / .32);
}
```

> [!TIP]
> Use `:root` everywhere, `.ec-root` for the banner, `.ec-preferences-backdrop` for user settings, or `#FeaturedConfigPage` for the admin page and preview.

## Theme variables

| Variable | Used for |
| --- | --- |
| `--ec-theme-primary` | Primary controls and selected states |
| `--ec-theme-primary-dark` | Primary hover state |
| `--ec-theme-primary-contrast` | Text on the primary color |
| `--ec-theme-secondary` | Focus outlines and secondary accents |
| `--ec-theme-secondary-contrast` | Text on the secondary color |
| `--ec-theme-background` | Dialog and page backgrounds |
| `--ec-theme-paper` | Raised surfaces and footer areas |
| `--ec-theme-appbar` | Dialog headers |
| `--ec-theme-text-primary` | Main interface text |
| `--ec-theme-text-secondary` | Muted interface text |
| `--ec-theme-divider` | Borders and separators |
| `--ec-theme-action-hover` | Hovered rows and controls |
| `--ec-theme-action-focus` | Focused controls |
| `--ec-theme-contained` | Neutral contained buttons |
| `--ec-theme-contained-hover` | Neutral contained-button hover state |
| `--ec-theme-error` | Error and excluded states |
| `--ec-theme-error-light` | Error text and borders |
| `--ec-theme-error-contrast` | Text on error backgrounds |
| `--ec-theme-radius` | Default control and surface radius |

Variables you do not set keep their Jellyfin or default value.

## Component variables

| Variable | Used for |
| --- | --- |
| `--ec-banner-radius` | Carousel viewport and slide clipping, including active trailers |
| `--ec-button-primary-background` | Play/details primary button background |
| `--ec-button-primary-hover-background` | Primary button hover/focus background |
| `--ec-button-primary-color` | Primary button text and icon color |
| `--ec-button-secondary-background` | Secondary button background |
| `--ec-button-secondary-hover-background` | Secondary button hover/focus background |
| `--ec-button-secondary-color` | Secondary button text and icon color |
| `--ec-button-radius` | Primary and secondary button radius |
| `--ec-button-border` | Primary and secondary button border |
| `--ec-button-shadow` | Primary and secondary button shadow |
| `--ec-dialog-background` | Preferences dialog background |
| `--ec-dialog-color` | Preferences dialog text |
| `--ec-dialog-border` | Preferences dialog outer border |
| `--ec-dialog-radius` | Preferences dialog radius |
| `--ec-dialog-shadow` | Preferences dialog shadow |
| `--ec-dialog-header-background` | Preferences dialog header |
| `--ec-dialog-footer-background` | Preferences dialog action footer |

Component variables you do not set use the matching theme value. Button changes also appear in the admin preview.

## Direct selectors

You can also use the `ec-*` classes directly. Start with `.ec-root` or `.ec-preferences-backdrop` so the rule does not affect the rest of Jellyfin.

| Area | Selectors |
| --- | --- |
| Carousel shell | `.ec-root`, `.ec-heading`, `.ec-viewport`, `.ec-track`, `.ec-slide` |
| Artwork and trailer | `.ec-backdrop`, `.ec-trailer`, `.ec-youtube-frame` |
| Copy | `.ec-content`, `.ec-logo`, `.ec-title`, `.ec-tagline`, `.ec-meta`, `.ec-overview` |
| Actions | `.ec-actions`, `.ec-button`, `.ec-button-secondary` |
| Navigation | `.ec-navigation`, `.ec-controls`, `.ec-control`, `.ec-dots`, `.ec-dot` |
| Preferences | `.ec-preferences-backdrop`, `.ec-preferences-dialog`, `.ec-preferences-header`, `.ec-preferences-content`, `.ec-preferences-actions` |
| Preference fields | `.ec-preference-source`, `.ec-preference-genre`, `.ec-preference-genre-marker`, `.ec-preference-boosts` |

State selectors: `.ec-hero`, `.ec-ready`, `.ec-trailer-active`, `.ec-controls-hover`, `.is-active`, `[data-genre-state="preferred"]`, and `[data-genre-state="excluded"]`.

For example:

```css
.ec-root .ec-title {
  font-family: Georgia, serif;
  letter-spacing: .02em;
}

.ec-root .ec-button-secondary {
  backdrop-filter: blur(12px);
}

.ec-root .ec-dot.is-active {
  transform: scale(1.35);
}
```

> [!WARNING]
> Use `--ec-*` variables and `.ec-*` selectors where possible. Jellyfin's own classes can change after an update.
