import styles from './styles/featured.css';
import webosOverrides from './styles/webos-overrides.css';
import { injectJellyfinThemeTokens } from './styles/jellyfin-theme';
import { installAdaptiveHeroOverview } from './slider/heroOverviewFit';
import { destroy, refresh, start } from './runtime';
import { CONSOLE_PREFIX, PLUGIN_VERSION } from './constants';

const STYLE_ID = 'jellyfin-featured-styles';
const loaderScript = document.currentScript as HTMLScriptElement | null;
const injectionMethod = loaderScript?.dataset.injectionMethod
  || (loaderScript?.hasAttribute('FileTransformation') ? 'file-transformation' : null)
  || (loaderScript?.hasAttribute('DirectInjection') ? 'direct' : null)
  || 'unknown';
const existingApi = window.JellyfinFeatured;

console.debug(`${CONSOLE_PREFIX} Loading v${PLUGIN_VERSION}; frontend injection method: ${injectionMethod}.`);

injectJellyfinThemeTokens();
installAdaptiveHeroOverview();

if (existingApi) {
  console.debug(`${CONSOLE_PREFIX} Existing v${existingApi.version} instance found; reusing it.`);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', existingApi.start, { once: true });
  } else {
    existingApi.start();
  }
} else {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${styles}\n${webosOverrides}`;
    document.head.appendChild(style);
  }

  const api = { version: PLUGIN_VERSION, start, destroy, refresh };
  window.JellyfinFeatured = api;
  console.debug(`${CONSOLE_PREFIX} Initialized v${PLUGIN_VERSION}.`);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
