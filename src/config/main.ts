import { createApp } from 'vue';
import App from './App.vue';
import configCss from './config.css';
import { injectJellyfinThemeTokens } from '../styles/jellyfin-theme';

const STYLE_ID = 'featuredConfigVueStyles';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = configCss;
  document.head.appendChild(style);
}

function mountConfigApp(): void {
  const mountPoint = document.querySelector<HTMLElement>('#FeaturedConfigApp');
  if (!mountPoint || mountPoint.dataset.vueMounted === 'true') return;
  mountPoint.dataset.vueMounted = 'true';
  injectJellyfinThemeTokens();
  injectStyles();
  createApp(App).mount(mountPoint);
}

mountConfigApp();
