# Contributing

This document applies to the `jellyfin-featured-plugin` repository.

Thanks for contributing to `Jellyfin Featured`.

## Where Help Is Welcome

All kinds of contributions are welcome, whether that is code, documentation, testing, bug reports, ideas, translations, or feedback from real Jellyfin setups.

Examples include:

- carousel behavior and layout fixes
- Jellyfin Web compatibility updates
- source, filtering, and curation improvements
- configuration UI and UX improvements
- accessibility and responsive-layout fixes
- clearer install, setup, build, and troubleshooting documentation
- English and German translation improvements
- manual test reports from different browsers, clients, and device types

## Before You Start

Please check:

- is there already an issue or discussion for this?
- is the change compatible with the latest supported Jellyfin version?
- does the Jellyfin home page still behave normally when the carousel is enabled and disabled?
- does the change preserve existing configurations where possible?

## Local Development

Install frontend dependencies:

```powershell
npm install
```

Build the plugin and frontend:

```powershell
.\build-release.ps1
```

That creates:

- `release/Featured/`
- `release/Featured.zip`

For configuration UI work with hot reloading:

```powershell
npm run dev
```

See [BUILD.md](./BUILD.md) for the full development and release workflow.

## Versioning

Plugin versions use `JellyfinMajor.PluginMajor.PluginMinor.PluginPatch` so the supported Jellyfin generation is visible immediately. Each new Jellyfin major version starts a new plugin line at `<JellyfinMajor>.1.0.0`; for example, Jellyfin 12 starts at `12.1.0.0` and Jellyfin 13 starts at `13.1.0.0`.

## Commit Style

This repository uses `git-cliff` to generate `CHANGELOG.md`, GitHub release notes, and the changelog entry for the latest version in `manifest.json`.

Because of that, commit messages should be short, clear, and useful on their own.

Good examples:

```text
fix(carousel): keep navigation state after refresh
feat(sources): add a new featured source type
feat(filters): support an additional filter rule
docs: improve installation troubleshooting
refactor(config): simplify source rule state
build: update Jellyfin packages to 12.0.0
```

Avoid vague commit messages like:

```text
stuff
fixes
update
more changes
```

## Pull Requests

- keep changes focused
- explain the problem and the fix clearly
- mention the Jellyfin version you tested against
- update documentation when behavior, installation, configuration, or the release flow changes
- include English and German translations for new user-facing configuration text
- target the `main` branch with pull requests

## Translation Workflow

English in [`src/i18n/locales/en.json`](./src/i18n/locales/en.json) is the reference locale. Other locale files may be partial: a missing or blank value falls back to English at runtime, while a key missing from English is shown as the key itself and reported once in the browser console.

To add or update a translation:

1. Use a short lowercase locale code for the JSON filename, for example `fr.json` or `pt-br.json`.
2. For a new language, start with an empty JSON object and add only reviewed translations. Do not copy untranslated English values merely to increase completion status.
3. Keep every key identical to the corresponding key in `en.json`, translate only its value, and preserve placeholders such as `{count}`, `{name}`, or `{score}` exactly.
4. Import the locale and register its code in [`src/i18n/index.ts`](./src/i18n/index.ts).
5. Run `npm run i18n:status` to regenerate [`docs/i18n-status.svg`](./docs/i18n-status.svg).
6. Run `npm test` and `npm run typecheck` before opening the pull request.

When introducing user-facing text, add the English reference string first and include German when possible. Translation-only pull requests may update one language at a time. Please mention whether a native speaker reviewed the wording and use the translation issue template for missing strings, wording questions, or requests for a new language.

## Manual Testing

If possible, test at least:

1. the featured carousel loads on the Jellyfin Web home page
2. slide navigation, touch interaction, and keyboard controls work
3. autoplay starts, pauses, and advances correctly
4. clicking the featured item or play button opens the expected media
5. source weighting and filters return eligible media
6. manual lists preserve ordering, scheduling, and enabled state
7. standard and hero layouts render correctly at different window sizes
8. logo/title, rating, description, and navigation display options behave correctly
9. background trailers remain muted and do not break slide navigation
10. disabling the plugin or frontend injection leaves the normal Jellyfin home page usable

When a change affects a specific source type, filter, media type, or user profile behavior, test that path directly as well.

## Coding Notes

- keep C# code readable and configuration migrations defensive
- keep frontend selectors and Jellyfin Web integration defensive
- avoid exposing internal curation or user-profile configuration in public runtime payloads
- preserve accessibility and keyboard behavior when changing carousel controls
- do not introduce silent breaking configuration changes

## License

By contributing, you agree that your code may be distributed under the [MIT License](./LICENSE) used by this project.
