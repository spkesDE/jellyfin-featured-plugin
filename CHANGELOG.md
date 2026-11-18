# Changelog

## v12.10.0.0 - 2026-11-18

### Features

- feat(a11y): respect reduced motion for autoplay and background video
- feat(filters): filter by trailer, artwork, studio, date added, HDR and series status
- feat(sources): add new episodes and coming soon sources
- feat(statistics): count banner impressions, opens and plays for admins
- feat(config): export and import settings as JSON
- feat(statistics): move banner statistics into their own tab with charts
- feat(statistics): put the table search and page size in the title row
- feat(config): custom number stepper and matching field surfaces

### Fixes

- fix(presets): treat an end time of 23:59 as the end of the day
- fix(users): remove stored data of deleted users
- fix(api): check library access for displayed, favourite and playstate updates
- fix(runtime): use the latest preset's display settings for placeholders
- fix(statistics): draw the impressions bar as a slim track beside the count
- fix(config): keep filter value hints inside the field

### Performance

- perf(config): cache the resolved configuration and query genres directly

## v12.9.2.0 - 2026-11-16

### Features

- feat(preferences): remember trailer mute and volume per user

## v12.9.1.0 - 2026-11-05

### Features

- feat(sources): allow custom source names

### Fixes

- fix(hero): measure against the visible following section
- fix(config): keep style injection out of the global scope
- fix(trailer): tolerate key events dispatched on document
- fix(config): load the settings bundle once per session
- fix(hero): lift the home tab with a margin instead of a transform
- fix(runtime): keep the cached carousel when the fresh response is identical
- fix(runtime): update upcoming slides without rebuilding the carousel

## v12.9.0.0 - 2026-10-24

### Features

- feat(hero): add vertical text position and keep text clear of header and controls
- feat(trailer): resolve media excerpts as trailer candidates
- feat(trailer): play media excerpts in the banner
- feat(preferences): let administrators manage another user's preferences
- feat(trailer): order banner media per source and filter SD YouTube trailers
- feat(presets): resolve the active preset and schedule state in the editor
- feat(config): add shared settings components

### Fixes

- fix(hero): keep controls on the right for right-aligned text

## v12.8.0.0 - 2026-10-03

### Features

- feat(trailer): add banner navigation and media controls positioning

## v12.7.2.0 - 2026-09-29

### Fixes

- fix(hero): preserve mobile hero fade on iOS
- fix(styles): fixed drop-shadow for overview
- fix(config): keep drag previews in styling scope

## v12.7.1.0 - 2026-09-26

### Features

- feat(cache): accelerate startup and coalesce remounts

### Performance

- perf(rule-engine): warm and streamline candidate loading

## v12.7.0.0 - 2026-09-26

### Features

- feat(injection): add resilient direct fallback
- feat(display): add interactive hero fade editor
- feat(config): mirror Jellyfin in banner preview

### Fixes

- fix(sources): fill feed from sole available source

## v12.6.0.0 - 2026-09-24

### Features

- feat(playback): add direct play and resume
- feat(recommendations): add persistent dismissal feedback
- feat(sources): add continuation and metadata filters

### Fixes

- fix(playback): restore play button hover state
- fix(styles): adjust max-width calculation for better responsiveness
- fix(styles): remove gap from actions and adjust media query formatting
- fix(preferences): remove dismissal cooldown hint
- fix(dismissals): preserve metadata icon color
- fix(playback): update playback button class for styling consistency
- fix(playstate): preserve metadata icon color on hover

## v12.5.1.0 - 2026-09-22

### Fixes

- fix(trailers): release volume slider focus after drag

## v12.5.0.0 - 2026-09-21

### Features

- feat: control background trailers per source rule
- feat: add Jellyfin movie recommendations as a mixer source
- feat: toggle viewer favorites from featured slides
- feat: make featured favorite button configurable for admins and users
- feat: place favorite heart in banner metadata
- feat(preferences): preload user settings cache
- feat(trailers): add configurable media controls
- feat(display): add fullscreen hero fade controls
- feat(playstate): add watched toggle beside favorites
- feat(styles): enhance CSS variables for responsive design and transitions
- feat(sources): add media fallbacks and resolution filter

### Fixes

- fix(navigation): preserve carousel focus and native keyboard controls
- fix: show critic rating with rotten icon
- fix: remove item-page critic rating classes
- fix: update favorites without reloading carousel
- fix(trailers): disable subtitles for remote trailers
- fix(favorites): keep metadata heart clickable
- fix(trailers): refine volume slider pill placement
- fix(carousel): hide focus border on pointer clicks
- fix(trailers): volume slider related styles fixes
- fix(settings): streamline configuration and preview controls
- fix(settings): keep live preview visible while scrolling

## v12.4.0.0 - 2026-09-15

### Fixes

- fix(hero): keep overlap layout stable with adaptive content
- fix(hero): preserve logos and align layout tests
- fix(hero): prioritize logos and align webOS tests
- fix(style): remove margin-top from config and featured sections for better alignment
- fix(hero): adapt overview lines to available space
- fix(hero): scope stacking context to viewport

## v12.3.1.0 - 2026-09-15

### Features

- feat: add CodeQL analysis and Dependency Review workflows
- feat(hero): bound whole-banner interactions
- feat(display): implement responsive layout for display settings
- feat(userProfiles): enhance user settings layout with responsive design
- feat(display): conditionally render banner heading based on hero layout setting
- feat(preferences): add user display opt-outs
- feat(preferences): apply changes without page reload
- feat(logo): add new beta logo image

### Fixes

- fix(carousel): update trailer handling and media structure in slides
- fix(hero): soften shared media fade
- fix(carousel): restrict hero hitbox to active slide
- fix(trailers): make source priority own remote fallback
- fix(trailers): honor start-muted setting on iOS
- fix(webos): support Chromium 79 and safe hero spacing
- fix(style): adjust spacing for meta elements in featured.css

## v12.3.0.0 - 2026-09-14

### Features

- feat(theming): enhance theming capabilities with new CSS variables and documentation
- feat: add feed preview functionality and better scheduling options for presets

### Fixes

- fix(styles): add border radius and clip-path to ec-slide for improved aesthetics
- fix(preview): refine layout and error handling

## v12.2.2.0 - 2026-09-14

### Features

- feat: implement Jellyfin theme tokens and update styles across components
- feat(i18n): enhance translation workflow and fallback handling

## v12.2.1.0 - 2026-09-13

### Features

- feat(carousel): implement trailer volume management with local storage

### Fixes

- fix(cache): enhance prepared cache diagnostics and add response serialization
- fix(config): set new default values

## v12.2.0.0 - 2026-09-13

### Features

- feat(personalization): add preference API and effective user settings
- feat(config): add personalization defaults and policy controls
- feat(carousel): add user personalization dialog
- feat(mixer): add constrained source allocation
- feat(config): expose source mixer controls
- feat(trailers): add source resolver and response model
- feat(player): support local remote and YouTube trailers
- feat(config): add trailer settings and overrides
- feat(presets): resolve scheduled configuration snapshots
- feat(config): add preset scheduling editor
- feat(personalization): add user menu settings entry
- feat(personalization): link user settings page
- feat(personalization): support excluded genres
- feat(trailers): add playback hotkeys
- feat(trailers): conceal YouTube startup controls
- feat(trailers): show startup countdown ring
- feat(trailers): add volume hotkeys
- feat(trailers): expose ordered fallback candidates
- feat(display): show controls only on hover
- feat(preferences): speed up and restyle user settings
- feat(preferences): add hourly item cooldown choices

### Fixes

- fix(personalization): preserve inherited server defaults
- fix(personalization): surface save failures and effective diagnostics
- fix(personalization): preserve mixer source settings
- fix(presets): refresh complete snapshots at boundaries
- fix(trailers): prevent duplicate fullscreen playback
- fix(config): restore genres and simplify global diversity
- fix(personalization): normalize settings responses
- fix(config): fix css for config page
- fix(trailers): block YouTube playback controls
- fix(trailers): fade playback into black canvas
- fix(personalization): repair dialog and add genre states
- fix(trailers): extend fade beyond hero edge
- fix(trailers): crossfade concealed YouTube playback
- fix(hero): finish backdrop fade before viewport edge
- fix(trailers): render countdown ring inside button
- fix(trailers): support inline playback on iOS
- fix(trailers): recover from YouTube preview failures
- fix(trailers): recover stalled media previews
- fix(carousel): isolate button keyboard input
- fix(hero): apply the mobile slide gradient
- fix(hero): preserve spacing across touch layouts
- fix(trailers): recover from blocked YouTube embeds
- fix(performance): defer user settings until opened

## v12.1.1.0 - 2026-09-12

### Features

- feat: Add sample file exclusion logic and corresponding tests in FeaturedRuleEngine

## v12.1.0.0 - 2026-09-12
