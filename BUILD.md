# Build Guide

Build and test Jellyfin Featured locally with Node.js and npm, the .NET 10 SDK, and PowerShell.

## Build the plugin

From the repository root, run:

```powershell
.\build-release.ps1
```

The script installs frontend dependencies, checks and bundles the frontend, builds the plugin, and creates `release/Featured/` and `release/Featured.zip`. Despite its name, you can use it for local testing; it does not publish anything.

Copy the files from `release/Featured/` to your Jellyfin plugin directory, restart Jellyfin, and test the change in Jellyfin Web. You do not need to run `npm run build` first.

## Work on the configuration UI

For the Vue configuration page, start the development server:

```powershell
npm install
npm run dev
```

This gives you hot reloading with mocked Jellyfin data. To test the page inside Jellyfin, build the plugin with `.\build-release.ps1` afterward.

## Run checks

```powershell
npm test
dotnet test .\JellyfinFeatured.sln
```

For frontend changes, `npm run build` also runs the TypeScript checks and creates the bundles in `dist/`. If you build the .NET project directly, run that command first so the generated frontend bundles are available.

Maintainers can find versioning and publishing instructions in the [release guide](./docs/releasing.md).
