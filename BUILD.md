# Build Guide

This guide explains how to build and test Jellyfin Featured locally.

## Requirements

Install:

- Node.js and npm
- .NET 10 SDK
- PowerShell

## Install Dependencies

Run this once after cloning the repository:

```powershell
npm install
```

Run it again when `package.json` or `package-lock.json` changes.

## Recommended Workflow

For normal development and testing, use:

```powershell
.\build-release.ps1
```

The script installs frontend dependencies, type-checks and bundles the frontend, builds the plugin, verifies the embedded bundles, and creates:

```text
release\Featured\
release\Featured.zip
```

To test a change:

1. Make your changes.
2. Run `.\build-release.ps1`.
3. Copy the generated plugin files to your Jellyfin plugin directory.
4. Restart Jellyfin.
5. Test the changes in Jellyfin Web.
6. Repeat as needed.

You do not need to run `npm run build` separately before using the release script.

## Configuration UI Development

Use the Vite development server when working only on the Vue configuration page:

```powershell
npm run dev
```

This provides hot reloading with mocked Jellyfin data for configuration UI work without a running Jellyfin server.

It does not create an installable plugin. Use `.\build-release.ps1` afterward to test the configuration page inside Jellyfin.

## Optional Frontend Watcher

To rebuild the frontend bundles automatically when source files change:

```powershell
npm run dev:bundle
```

This updates:

```text
dist\featured.bundle.js
dist\config.bundle.js
```

## Manual Build

Type-check and build the frontend:

```powershell
npm run build
```

Build the plugin:

```powershell
dotnet build .\Jellyfin.Plugin.Featured\Jellyfin.Plugin.Featured.csproj --configuration Release
```

You can also build the complete solution:

```powershell
dotnet build .\JellyfinFeatured.sln --configuration Release
```

The .NET build expects these generated frontend files:

- `dist/featured.bundle.js`
- `dist/config.bundle.js`

## Adding Configuration Fields

To add a new setting:

1. Add the property to:

   ```text
   Jellyfin.Plugin.Featured\Configuration\PluginConfiguration.cs
   ```

2. Add validation or migration to `PluginConfigurationNormalizer.cs` when required.
3. Update the frontend configuration types in `src/types/config.ts`.
4. Add the setting to the relevant Vue configuration tab or component.
5. Add a fallback to `src/config/libs/defaults.ts` when the UI needs a value before the server configuration loads.
6. Add or update English and German strings in `src/i18n/locales/` when the setting introduces user-facing text.

## Release Workflow

Plugin versions use `JellyfinMajor.PluginMajor.PluginMinor.PluginPatch` so the supported Jellyfin generation is visible immediately. Jellyfin 12 starts at `12.1.0.0`.

For a release package with release notes:

```powershell
.\build-release.ps1 -Changelog "Describe the release."
```

The release pipeline validates synchronized project and frontend versions, verifies the generated JavaScript bundles and their embedded copies, writes the release metadata, and creates `release\Featured.zip`.

Tagged GitHub releases also publish a signed build-provenance attestation for `Featured.zip`. Verify a downloaded release with:

```powershell
gh attestation verify .\Featured.zip --repo spkesDE/jellyfin-featured-plugin
```

To prepare and push a tagged release from a clean `main` branch:

```powershell
.\push-release.ps1
```

GitHub Actions requires the repository variable `RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY` for the release GitHub App.

## Beta Releases

The `Publish Beta` workflow creates a disposable prerelease from the branch or revision selected in GitHub Actions. It uses one moving `beta` tag and replaces the previous beta release, so only the newest test build remains available. Beta package metadata and the dedicated manifest use `logo-beta.png`; stable packages and `manifest.json` continue to use `logo.png`.

Beta versions use the stable version currently stored on `main` as their base. For example, stable `12.3.0.0` produces `12.3.0.1`, then `12.3.0.2`. When the stable version on `main` changes to `12.3.1.0`, the next beta starts at `12.3.1.1`.

Testers can add this dedicated plugin repository URL to Jellyfin:

```text
https://raw.githubusercontent.com/spkesDE/jellyfin-featured-plugin/main/manifest-beta.json
```

The `workflow_dispatch` workflow file must already be present on GitHub's default branch (`main`) before the first manual run. Keep the webOS fix on `fix/webos` if it still needs testing: publish only the beta workflow infrastructure to `main`, push `fix/webos`, then choose `fix/webos` in the GitHub Actions branch dropdown when running `Publish Beta`.

After publishing the prerelease, the workflow commits the beta manifest and beta logo to `main`. The manifest contains exactly one version and points to the ZIP attached to the same prerelease. Publish the eventual stable fix with a higher version base (for example `12.3.1.0` after the `12.3.0.x` beta series) so Jellyfin sees it as newer than every beta based on `12.3.0.0`.
