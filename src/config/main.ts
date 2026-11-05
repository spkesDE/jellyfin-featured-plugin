import { createApp } from 'vue';
import App from './App.vue';
import { createConfigAppMounter } from './appMounts';
import configCss from './config.css?inline';
import { injectJellyfinThemeTokens } from '../styles/jellyfin-theme';

const STYLE_ID = 'featuredConfigVueStyles';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = configCss;
  document.head.appendChild(style);
}

const mountConfigApp = createConfigAppMounter(
  () => createApp(App),
  () => {
    injectJellyfinThemeTokens();
    injectStyles();
  }
);

window.JellyfinFeaturedConfig = { mount: mountConfigApp };
mountConfigApp();
