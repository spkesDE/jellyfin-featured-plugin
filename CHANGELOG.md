# Changelog

## v12.2.1.0 - 2026-09-13

### Features

- feat(carousel): implement trailer volume management with local storage

### Fixes

- fix(cache): enhance prepared cache diagnostics and add response serialization
- fix(config): set new default values

### Documentation

- docs: update README and add cache and trailer behavior documentation

### Refactoring

- refactor(ruleEngine): Refactor Featured Rule Engine and Enhance Timing Diagnostics
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

### Documentation

- docs: Revise README for clarity and update installation instructions
- docs: Add section for additional Jellyfin plugins in README
- docs: document completed 12.2 personalization
- docs: document completed source mixer v2
- docs: document proper trailer support
- docs: document featured preset scheduling
- docs: simplify readme for end users

### Refactoring

- refactor(mixer): split rule engine responsibilities
- refactor(api): split controller endpoints
- refactor(player): reorganize player initialization and event handling

### Other

- test(trailers): cover resolver and player contracts
- test(config): align layout contract with page styles
- revert(trailers): restore compact backdrop fade
- style(preferences): enlarge responsive settings modal
## v12.1.1.0 - 2026-09-12

### Features

- feat: Add sample file exclusion logic and corresponding tests in FeaturedRuleEngine

### Documentation

- docs: Add Star History section to README

### Refactoring

- refactor: Improve item selection logic in FeaturedPreparedCache and update tests

### Other

- chore: Update JavaScript Injector repository URL in README
## v12.1.0.0 - 2026-09-12

### Other

- Initial commit 12.1.0.0

