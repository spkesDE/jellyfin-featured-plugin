# Changelog

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

### Other

- chore(tests): split and prune test suites
- deps(deps): bump the npm-minor-and-patch group with 3 updates (#13)
- deps: Bump the nuget-minor-and-patch group with 4 updates (#15)
- deps(deps-dev): bump typescript from 5.9.3 to 6.0.3 (#14)
## v12.4.0.0 - 2026-09-15

### Fixes

- fix(webos): support Chromium 79 and safe hero spacing
- fix(style): adjust spacing for meta elements in featured.css
- fix(hero): keep overlap layout stable with adaptive content
- fix(hero): preserve logos and align layout tests
- fix(hero): prioritize logos and align webOS tests
- fix(style): remove margin-top from config and featured sections for better alignment
- fix(hero): adapt overview lines to available space
- fix(hero): scope stacking context to viewport
## v12.3.1.1 - 2026-09-15

### Fixes

- fix(release): commit synchronized frontend version

### Other

- chore: update plugin version to 12.3.1.0
## v12.3.1.0 - 2026-09-15

### Features

- feat(dependabot): add configuration for npm, nuget, and GitHub Actions updates
- feat: add CodeQL analysis and Dependency Review workflows
- feat(hero): bound whole-banner interactions
- feat(display): implement responsive layout for display settings
- feat(userProfiles): enhance user settings layout with responsive design
- feat(display): conditionally render banner heading based on hero layout setting
- feat(preferences): add user display opt-outs
- feat(preferences): apply changes without page reload
- feat(logo): add new beta logo image
- feat(beta): prepare standalone beta release infrastructure (#10)

### Fixes

- fix(ci): remove push trigger from CI workflow
- fix(carousel): update trailer handling and media structure in slides
- fix(hero): soften shared media fade
- fix(carousel): restrict hero hitbox to active slide
- fix(trailers): make source priority own remote fallback
- fix(trailers): honor start-muted setting on iOS

### Documentation

- docs: update build guide and contributing documentation for clarity and workflow improvements

### Other

- deps(deps-dev): bump vite in the npm-minor-and-patch group (#2)
- deps: Bump the nuget-minor-and-patch group with 1 update (#4)
- deps: Bump Microsoft.NET.Test.Sdk from 17.14.1 to 18.10.0 (#5)
- deps: Bump xunit.runner.visualstudio from 3.1.5 to 4.0.0 (#7)
- Update beta manifest and logo for 12.3.0.1
## v12.3.0.0 - 2026-09-14

### Features

- feat(theming): enhance theming capabilities with new CSS variables and documentation
- feat(readme): add additional badges for license, release, Jellyfin version, and build status
- feat: add feed preview functionality and better scheduling options for presets

### Fixes

- fix(styles): add border radius and clip-path to ec-slide for improved aesthetics
- fix(preview): refine layout and error handling
## v12.2.2.0 - 2026-09-14

### Features

- feat: implement Jellyfin theme tokens and update styles across components
- feat(i18n): enhance translation workflow and fallback handling

### Documentation

- docs: add translation status badge to README
- docs: highlight 12.2.1 performance improvements
- docs: add performance in README
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

